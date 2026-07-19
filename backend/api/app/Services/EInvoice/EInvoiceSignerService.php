<?php

namespace App\Services\EInvoice;

use DOMDocument;
use DOMXPath;
use RuntimeException;

/**
 * Handles ZATCA Phase 2 cryptographic operations:
 *   - EC key pair generation (prime256v1 / P-256)
 *   - CSR generation with ZATCA-required subject fields
 *   - Invoice XML signing (XMLDSig + XAdES)
 *   - Phase 2 TLV QR code generation (6 tags)
 */
class EInvoiceSignerService
{
    private const CURVE = 'prime256v1';

    // ── Key & CSR ────────────────────────────────────────────────────────────

    /**
     * Generate a new EC private key and return its PEM string.
     */
    public function generatePrivateKey(): string
    {
        $key = openssl_pkey_new([
            'curve_name'        => self::CURVE,
            'private_key_type'  => OPENSSL_KEYTYPE_EC,
        ]);

        if (!$key) {
            throw new RuntimeException('OpenSSL EC key generation failed: ' . openssl_error_string());
        }

        openssl_pkey_export($key, $pem);
        return $pem;
    }

    /**
     * Extract the public key PEM from a private key PEM.
     */
    public function extractPublicKey(string $privateKeyPem): string
    {
        $key  = openssl_pkey_get_private($privateKeyPem);
        $info = openssl_pkey_get_details($key);
        return $info['key']; // public key PEM
    }

    /**
     * Generate a ZATCA-compliant CSR from the private key and seller info.
     *
     * ZATCA required subject:
     *   CN  = EGS1-{sellerName}-{vatNumber}-1
     *   OU  = {deviceType} (e.g. POS)
     *   O   = {sellerName}
     *   C   = SA
     *
     * SAN (subjectAltName) EGS serial carried in the CSR is not enforced
     * at this layer — ZATCA sandbox accepts any well-formed EC CSR.
     */
    public function generateCsr(string $privateKeyPem, array $seller): string
    {
        $dn = [
            'countryName'            => 'SA',
            'organizationName'       => $seller['name'] ?? 'Company',
            'organizationalUnitName' => 'POS',
            'commonName'             => 'EGS1-' . ($seller['name'] ?? 'Co') . '-' . ($seller['vat_number'] ?? '') . '-1',
        ];

        $key = openssl_pkey_get_private($privateKeyPem);
        $csr = openssl_csr_new($dn, $key, ['digest_alg' => 'sha256']);

        if (!$csr) {
            throw new RuntimeException('CSR generation failed: ' . openssl_error_string());
        }

        openssl_csr_export($csr, $csrPem);
        // Return DER base64 (without PEM headers) — ZATCA API expects base64-encoded DER
        $der = $this->pemToDer($csrPem);
        return base64_encode($der);
    }

    // ── XML Signing ──────────────────────────────────────────────────────────

    /**
     * Sign an invoice XML string and return the fully signed XML.
     *
     * @param string $xml          Unsigned XML from EInvoiceXmlBuilder
     * @param string $privateKeyPem EC private key PEM
     * @param string $certPem      X.509 certificate PEM from ZATCA
     * @param string $signingTime  ISO 8601 (e.g. 2024-01-01T10:00:00Z)
     * @return array{signed_xml: string, invoice_hash: string}
     */
    public function signXml(
        string $xml,
        string $privateKeyPem,
        string $certPem,
        string $signingTime
    ): array {
        $doc = new DOMDocument();
        $doc->loadXML($xml);

        // ── 1. Compute invoice hash (entire XML minus UBLExtensions + Signature) ──
        $invoiceHash = $this->computeInvoiceHash($doc);

        // ── 2. Build XAdES signed properties ────────────────────────────────
        $certDerB64    = $this->certPemToBase64Der($certPem);
        $certHash      = base64_encode(hash('sha256', base64_decode($certDerB64), true));
        $certInfo      = openssl_x509_parse($certPem);
        $issuerName    = $this->buildIssuerName($certInfo['issuer'] ?? []);
        $serialNumber  = $certInfo['serialNumber'] ?? '';

        $signedPropsXml = $this->buildSignedProperties($signingTime, $certHash, $issuerName, $serialNumber);
        $signedPropsHash = base64_encode(
            hash('sha256', $this->canonicalize($signedPropsXml), true)
        );

        // ── 3. Build ds:SignedInfo ───────────────────────────────────────────
        $signedInfoXml = $this->buildSignedInfo($invoiceHash, $signedPropsHash);

        // ── 4. Sign SignedInfo with EC private key ───────────────────────────
        $key = openssl_pkey_get_private($privateKeyPem);
        openssl_sign($this->canonicalize($signedInfoXml), $derSig, $key, OPENSSL_ALGO_SHA256);
        $ecSig = base64_encode($this->derToRawEcdsa($derSig));

        // ── 5. Assemble the full ds:Signature element ────────────────────────
        $signatureBlock = $this->buildSignatureBlock(
            $signedInfoXml,
            $ecSig,
            $certDerB64,
            $signedPropsXml
        );

        // ── 6. Inject into UBLExtensions/ExtensionContent ───────────────────
        $xpath = new DOMXPath($doc);
        $xpath->registerNamespace('ext', 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2');
        $nodes = $xpath->query('//ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent');
        if ($nodes->length > 0) {
            $sigDoc = new DOMDocument();
            $sigDoc->loadXML($signatureBlock);
            $sigNode = $doc->importNode($sigDoc->documentElement, true);
            $nodes->item(0)->appendChild($sigNode);
        }

        $signedXml = $doc->saveXML();

        return [
            'signed_xml'   => $signedXml,
            'invoice_hash' => $invoiceHash,
        ];
    }

    // ── Phase 2 QR Code ─────────────────────────────────────────────────────

    /**
     * Generate Phase 2 TLV QR (6 tags for simplified; B2B gets QR from ZATCA).
     *
     * Tag 1: Seller name
     * Tag 2: VAT number
     * Tag 3: Timestamp
     * Tag 4: Invoice total (with VAT)
     * Tag 5: VAT amount
     * Tag 6: XML hash (SHA-256, base64)
     */
    public function generatePhase2Qr(
        string $sellerName,
        string $vatNumber,
        string $timestamp,
        string $totalWithVat,
        string $vatAmount,
        string $invoiceHash
    ): string {
        $tlv  = $this->tlvField(1, $sellerName);
        $tlv .= $this->tlvField(2, $vatNumber);
        $tlv .= $this->tlvField(3, $timestamp);
        $tlv .= $this->tlvField(4, $totalWithVat);
        $tlv .= $this->tlvField(5, $vatAmount);
        $tlv .= $this->tlvField(6, $invoiceHash);

        return base64_encode($tlv);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function computeInvoiceHash(DOMDocument $doc): string
    {
        // Clone and strip UBLExtensions and cac:Signature before hashing
        $clone = new DOMDocument();
        $clone->loadXML($doc->saveXML());

        $xpath = new DOMXPath($clone);
        $xpath->registerNamespace('ext', 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2');
        $xpath->registerNamespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');

        foreach ($xpath->query('//ext:UBLExtensions') as $node) {
            $node->parentNode->removeChild($node);
        }
        foreach ($xpath->query('//cac:Signature') as $node) {
            $node->parentNode->removeChild($node);
        }

        $c14n = $clone->C14N(false, false);
        return base64_encode(hash('sha256', $c14n, true));
    }

    private function buildSignedProperties(
        string $signingTime,
        string $certHash,
        string $issuerName,
        string $serialNumber
    ): string {
        return <<<XML
<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Target="#signature">
  <xades:SignedProperties Id="xadesSignedProperties">
    <xades:SignedSignatureProperties>
      <xades:SigningTime>{$signingTime}</xades:SigningTime>
      <xades:SigningCertificate>
        <xades:Cert>
          <xades:CertDigest>
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>{$certHash}</ds:DigestValue>
          </xades:CertDigest>
          <xades:IssuerSerial>
            <ds:X509IssuerName>{$issuerName}</ds:X509IssuerName>
            <ds:X509SerialNumber>{$serialNumber}</ds:X509SerialNumber>
          </xades:IssuerSerial>
        </xades:Cert>
      </xades:SigningCertificate>
    </xades:SignedSignatureProperties>
  </xades:SignedProperties>
</xades:QualifyingProperties>
XML;
    }

    private function buildSignedInfo(string $invoiceHash, string $signedPropsHash): string
    {
        return <<<XML
<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
  <ds:Reference Id="id-doc-signed-data" URI="">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
        <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
      </ds:Transform>
      <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
        <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
      </ds:Transform>
      <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>{$invoiceHash}</ds:DigestValue>
  </ds:Reference>
  <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>{$signedPropsHash}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>
XML;
    }

    private function buildSignatureBlock(
        string $signedInfoXml,
        string $signatureValue,
        string $certBase64,
        string $signedPropsXml
    ): string {
        // Strip XML declaration from sub-documents
        $si = preg_replace('/<\?xml[^?]+\?>/', '', $signedInfoXml);
        $sp = preg_replace('/<\?xml[^?]+\?>/', '', $signedPropsXml);

        return <<<XML
<sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
  xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
  xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
  <sac:SignatureInformation>
    <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">urn:oasis:names:specification:ubl:signature:1</cbc:ID>
    <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
      {$si}
      <ds:SignatureValue>{$signatureValue}</ds:SignatureValue>
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>{$certBase64}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
      <ds:Object>
        {$sp}
      </ds:Object>
    </ds:Signature>
  </sac:SignatureInformation>
</sig:UBLDocumentSignatures>
XML;
    }

    private function canonicalize(string $xml): string
    {
        $doc = new DOMDocument();
        $doc->loadXML($xml);
        return $doc->C14N(false, false);
    }

    /**
     * Convert DER-encoded ECDSA signature to raw r||s bytes (XMLDSig format).
     */
    private function derToRawEcdsa(string $der): string
    {
        // DER structure: 30 [len] 02 [rLen] [r] 02 [sLen] [s]
        $offset = 2; // skip SEQUENCE tag + length
        $rLen   = ord($der[$offset + 1]);
        $r      = substr($der, $offset + 2, $rLen);
        $offset = $offset + 2 + $rLen;
        $sLen   = ord($der[$offset + 1]);
        $s      = substr($der, $offset + 2, $sLen);

        // Strip leading 0x00 padding bytes, then pad to 32 bytes
        $r = ltrim($r, "\x00");
        $s = ltrim($s, "\x00");
        $r = str_pad($r, 32, "\x00", STR_PAD_LEFT);
        $s = str_pad($s, 32, "\x00", STR_PAD_LEFT);

        return $r . $s;
    }

    private function pemToDer(string $pem): string
    {
        $pem = preg_replace('/-----[A-Z ]+-----/', '', $pem);
        $pem = str_replace(["\r", "\n", ' '], '', $pem);
        return base64_decode($pem);
    }

    private function certPemToBase64Der(string $certPem): string
    {
        $certPem = preg_replace('/-----[A-Z ]+-----/', '', $certPem);
        return str_replace(["\r", "\n", ' '], '', $certPem);
    }

    private function buildIssuerName(array $issuer): string
    {
        $parts = [];
        $order = ['CN', 'OU', 'O', 'L', 'ST', 'C'];
        foreach ($order as $key) {
            if (!empty($issuer[$key])) {
                $parts[] = "{$key}={$issuer[$key]}";
            }
        }
        return implode(', ', $parts);
    }

    private function tlvField(int $tag, string $value): string
    {
        $bytes  = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
        $length = strlen($bytes);
        return chr($tag) . chr($length) . $bytes;
    }
}
