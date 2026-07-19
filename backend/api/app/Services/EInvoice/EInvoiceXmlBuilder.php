<?php

namespace App\Services\EInvoice;

use DOMDocument;
use DOMElement;

/**
 * Builds ZATCA Phase 2 UBL 2.1 invoice XML.
 *
 * The unsigned XML contains an empty ExtensionContent placeholder.
 * EInvoiceSignerService replaces it with the full ds:Signature block.
 */
class EInvoiceXmlBuilder
{
    private const NS_INV  = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
    private const NS_CAC  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
    private const NS_CBC  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
    private const NS_EXT  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';

    /**
     * Build unsigned invoice XML.
     *
     * @param array{
     *   invoice_type: 'simplified'|'standard'|'credit_note',
     *   invoice_number: string,
     *   uuid: string,
     *   issue_date: string,   // YYYY-MM-DD
     *   issue_time: string,   // HH:MM:SS
     *   invoice_counter: int,
     *   previous_invoice_hash: string,
     *   currency: string,
     *   payment_means_code: string,
     *   seller: array,
     *   buyer: array,
     *   lines: array,
     *   subtotal: float,
     *   discount_total: float,
     *   tax_total: float,
     *   grand_total: float,
     *   vat_rate: float,
     *   qr_placeholder: string,
     * } $p
     */
    public function build(array $p): string
    {
        $doc = new DOMDocument('1.0', 'UTF-8');
        $doc->formatOutput = false;

        $root = $doc->createElementNS(self::NS_INV, 'Invoice');
        $root->setAttribute('xmlns:cac', self::NS_CAC);
        $root->setAttribute('xmlns:cbc', self::NS_CBC);
        $root->setAttribute('xmlns:ext', self::NS_EXT);
        $doc->appendChild($root);

        // Empty UBLExtensions — signer will fill ExtensionContent
        $exts = $doc->createElement('ext:UBLExtensions');
        $ext  = $doc->createElement('ext:UBLExtension');
        $uri  = $doc->createElement('ext:ExtensionURI');
        $uri->textContent = 'urn:oasis:names:specification:ubl:dsig:ext:XMLDSIG';
        $ext->appendChild($uri);
        $content = $doc->createElement('ext:ExtensionContent');
        $ext->appendChild($content);
        $exts->appendChild($ext);
        $root->appendChild($exts);

        // Profile and core fields
        $isSimplified = $p['invoice_type'] === 'simplified';
        $isCreditNote = $p['invoice_type'] === 'credit_note';

        $this->cbc($doc, $root, 'ProfileID', $isSimplified ? 'reporting:1.0' : 'clearance:1.0');
        $this->cbc($doc, $root, 'ID', $p['invoice_number']);
        $this->cbc($doc, $root, 'UUID', $p['uuid']);
        $this->cbc($doc, $root, 'IssueDate', $p['issue_date']);
        $this->cbc($doc, $root, 'IssueTime', $p['issue_time']);

        // InvoiceTypeCode: 388=invoice, 381=credit note
        $typeEl = $this->cbc($doc, $root, 'InvoiceTypeCode', $isCreditNote ? '381' : '388');
        if ($isSimplified) {
            $typeEl->setAttribute('name', $isCreditNote ? '0200001' : '0200000');
        } else {
            $typeEl->setAttribute('name', $isCreditNote ? '0100001' : '0100000');
        }

        $cur = $p['currency'] ?? 'SAR';
        $this->cbc($doc, $root, 'DocumentCurrencyCode', $cur);
        $this->cbc($doc, $root, 'TaxCurrencyCode', $cur);

        // ICV — invoice counter value
        $icvRef = $doc->createElement('cac:AdditionalDocumentReference');
        $this->cbc($doc, $icvRef, 'ID', 'ICV');
        $this->cbc($doc, $icvRef, 'UUID', (string)$p['invoice_counter']);
        $root->appendChild($icvRef);

        // PIH — previous invoice hash
        $pihRef = $doc->createElement('cac:AdditionalDocumentReference');
        $this->cbc($doc, $pihRef, 'ID', 'PIH');
        $pihAttach = $doc->createElement('cac:Attachment');
        $pihData   = $doc->createElement('cbc:EmbeddedDocumentBinaryObject');
        $pihData->setAttribute('mimeCode', 'text/plain');
        $pihData->textContent = $p['previous_invoice_hash'];
        $pihAttach->appendChild($pihData);
        $pihRef->appendChild($pihAttach);
        $root->appendChild($pihRef);

        // QR placeholder (simplified) — signer replaces with real Phase 2 QR
        if ($isSimplified) {
            $qrRef    = $doc->createElement('cac:AdditionalDocumentReference');
            $this->cbc($doc, $qrRef, 'ID', 'QR');
            $qrAttach = $doc->createElement('cac:Attachment');
            $qrData   = $doc->createElement('cbc:EmbeddedDocumentBinaryObject');
            $qrData->setAttribute('mimeCode', 'text/plain');
            $qrData->textContent = $p['qr_placeholder'] ?? '';
            $qrAttach->appendChild($qrData);
            $qrRef->appendChild($qrAttach);
            $root->appendChild($qrRef);
        }

        // Signature stub
        $sig = $doc->createElement('cac:Signature');
        $this->cbc($doc, $sig, 'ID', 'urn:oasis:names:specification:ubl:signature:Invoice');
        $this->cbc($doc, $sig, 'SignatureMethod', 'urn:oasis:names:specification:ubl:dsig:enveloped:xades');
        $root->appendChild($sig);

        // Seller
        $this->appendSupplierParty($doc, $root, $p['seller'], $cur);

        // Buyer
        $this->appendCustomerParty($doc, $root, $p['buyer'], $cur);

        // Delivery
        $delivery = $doc->createElement('cac:Delivery');
        $this->cbc($doc, $delivery, 'ActualDeliveryDate', $p['issue_date']);
        $root->appendChild($delivery);

        // Payment means
        $pm = $doc->createElement('cac:PaymentMeans');
        $this->cbc($doc, $pm, 'PaymentMeansCode', $p['payment_means_code'] ?? '10');
        $root->appendChild($pm);

        // Tax total
        $this->appendTaxTotal($doc, $root, $p['tax_total'], $p['subtotal'] - $p['discount_total'], $p['vat_rate'], $cur);

        // Legal monetary total
        $this->appendLegalMonetaryTotal($doc, $root, $p, $cur);

        // Lines
        foreach ($p['lines'] as $i => $line) {
            $this->appendInvoiceLine($doc, $root, $line, $i + 1, $p['vat_rate'], $cur);
        }

        return $doc->saveXML();
    }

    // ── Seller ───────────────────────────────────────────────────────────────

    private function appendSupplierParty(DOMDocument $doc, DOMElement $parent, array $s, string $cur): void
    {
        $asp   = $doc->createElement('cac:AccountingSupplierParty');
        $party = $doc->createElement('cac:Party');

        if (!empty($s['cr_number'])) {
            $pid = $doc->createElement('cac:PartyIdentification');
            $pidId = $this->cbc($doc, $pid, 'ID', $s['cr_number']);
            $pidId->setAttribute('schemeID', 'CRN');
            $party->appendChild($pid);
        }

        $addr = $doc->createElement('cac:PostalAddress');
        $this->cbc($doc, $addr, 'StreetName',            $s['street_name']     ?? '');
        $this->cbc($doc, $addr, 'BuildingNumber',        $s['building_number'] ?? '0000');
        $this->cbc($doc, $addr, 'CitySubdivisionName',   $s['district']        ?? '');
        $this->cbc($doc, $addr, 'CityName',              $s['city']            ?? '');
        $this->cbc($doc, $addr, 'PostalZone',            $s['postal_code']     ?? '00000');
        $country = $doc->createElement('cac:Country');
        $this->cbc($doc, $country, 'IdentificationCode', $s['country_code'] ?? 'SA');
        $addr->appendChild($country);
        $party->appendChild($addr);

        if (!empty($s['vat_number'])) {
            $pts = $doc->createElement('cac:PartyTaxScheme');
            $this->cbc($doc, $pts, 'CompanyID', $s['vat_number']);
            $ts  = $doc->createElement('cac:TaxScheme');
            $this->cbc($doc, $ts, 'ID', 'VAT');
            $pts->appendChild($ts);
            $party->appendChild($pts);
        }

        $ple = $doc->createElement('cac:PartyLegalEntity');
        $this->cbc($doc, $ple, 'RegistrationName', $s['name'] ?? '');
        $party->appendChild($ple);

        $asp->appendChild($party);
        $parent->appendChild($asp);
    }

    // ── Buyer ────────────────────────────────────────────────────────────────

    private function appendCustomerParty(DOMDocument $doc, DOMElement $parent, array $b, string $cur): void
    {
        $acp   = $doc->createElement('cac:AccountingCustomerParty');
        $party = $doc->createElement('cac:Party');

        $addr = $doc->createElement('cac:PostalAddress');
        $this->cbc($doc, $addr, 'StreetName',          $b['street_name']     ?? 'N/A');
        $this->cbc($doc, $addr, 'BuildingNumber',      $b['building_number'] ?? '0000');
        $this->cbc($doc, $addr, 'CitySubdivisionName', $b['district']        ?? 'N/A');
        $this->cbc($doc, $addr, 'CityName',            $b['city']            ?? 'N/A');
        $this->cbc($doc, $addr, 'PostalZone',          $b['postal_code']     ?? '00000');
        $country = $doc->createElement('cac:Country');
        $this->cbc($doc, $country, 'IdentificationCode', $b['country_code'] ?? 'SA');
        $addr->appendChild($country);
        $party->appendChild($addr);

        $pts = $doc->createElement('cac:PartyTaxScheme');
        if (!empty($b['vat_number'])) {
            $this->cbc($doc, $pts, 'CompanyID', $b['vat_number']);
        }
        $ts = $doc->createElement('cac:TaxScheme');
        $this->cbc($doc, $ts, 'ID', 'VAT');
        $pts->appendChild($ts);
        $party->appendChild($pts);

        $ple = $doc->createElement('cac:PartyLegalEntity');
        $this->cbc($doc, $ple, 'RegistrationName', $b['name'] ?? 'Customer');
        $party->appendChild($ple);

        $acp->appendChild($party);
        $parent->appendChild($acp);
    }

    // ── Tax Total ────────────────────────────────────────────────────────────

    private function appendTaxTotal(
        DOMDocument $doc, DOMElement $parent,
        float $taxAmount, float $taxableAmount, float $vatRate, string $cur
    ): void {
        $tt = $doc->createElement('cac:TaxTotal');
        $ta = $this->cbc($doc, $tt, 'TaxAmount', number_format($taxAmount, 2, '.', ''));
        $ta->setAttribute('currencyID', $cur);

        $sub = $doc->createElement('cac:TaxSubtotal');
        $txa = $this->cbc($doc, $sub, 'TaxableAmount', number_format($taxableAmount, 2, '.', ''));
        $txa->setAttribute('currencyID', $cur);
        $taa = $this->cbc($doc, $sub, 'TaxAmount', number_format($taxAmount, 2, '.', ''));
        $taa->setAttribute('currencyID', $cur);

        $cat = $doc->createElement('cac:TaxCategory');
        $this->cbc($doc, $cat, 'ID', 'S');
        $this->cbc($doc, $cat, 'Percent', number_format($vatRate, 2, '.', ''));
        $ts = $doc->createElement('cac:TaxScheme');
        $this->cbc($doc, $ts, 'ID', 'VAT');
        $cat->appendChild($ts);
        $sub->appendChild($cat);
        $tt->appendChild($sub);
        $parent->appendChild($tt);
    }

    // ── Legal Monetary Total ─────────────────────────────────────────────────

    private function appendLegalMonetaryTotal(DOMDocument $doc, DOMElement $parent, array $p, string $cur): void
    {
        $lmt = $doc->createElement('cac:LegalMonetaryTotal');
        $net = $p['subtotal'] - $p['discount_total'];

        $fields = [
            'LineExtensionAmount' => $p['subtotal'],
            'TaxExclusiveAmount'  => $net,
            'TaxInclusiveAmount'  => $p['grand_total'],
            'AllowanceTotalAmount'=> $p['discount_total'],
            'PrepaidAmount'       => 0,
            'PayableAmount'       => $p['grand_total'],
        ];

        foreach ($fields as $tag => $value) {
            $el = $this->cbc($doc, $lmt, $tag, number_format((float)$value, 2, '.', ''));
            $el->setAttribute('currencyID', $cur);
        }

        $parent->appendChild($lmt);
    }

    // ── Invoice Line ─────────────────────────────────────────────────────────

    private function appendInvoiceLine(
        DOMDocument $doc, DOMElement $parent,
        array $line, int $seq, float $vatRate, string $cur
    ): void {
        $qty       = (float)($line['quantity'] ?? 1);
        $price     = (float)($line['unitPrice'] ?? 0);
        $discount  = (float)($line['discountValue'] ?? 0);
        $taxAmount = (float)($line['taxAmount'] ?? 0);
        $net       = ($qty * $price) - $discount;
        $lineTotal = $net + $taxAmount;

        $il = $doc->createElement('cac:InvoiceLine');
        $this->cbc($doc, $il, 'ID', (string)$seq);
        $iq = $this->cbc($doc, $il, 'InvoicedQuantity', number_format($qty, 2, '.', ''));
        $iq->setAttribute('unitCode', 'PCE');
        $lea = $this->cbc($doc, $il, 'LineExtensionAmount', number_format($net, 2, '.', ''));
        $lea->setAttribute('currencyID', $cur);

        // Line tax
        $ltt = $doc->createElement('cac:TaxTotal');
        $ltA = $this->cbc($doc, $ltt, 'TaxAmount', number_format($taxAmount, 2, '.', ''));
        $ltA->setAttribute('currencyID', $cur);
        $ltR = $this->cbc($doc, $ltt, 'RoundingAmount', number_format($lineTotal, 2, '.', ''));
        $ltR->setAttribute('currencyID', $cur);
        $il->appendChild($ltt);

        // Item
        $item = $doc->createElement('cac:Item');
        $this->cbc($doc, $item, 'Name', $line['name'] ?? 'Item');
        $ctc = $doc->createElement('cac:ClassifiedTaxCategory');
        $this->cbc($doc, $ctc, 'ID', 'S');
        $this->cbc($doc, $ctc, 'Percent', number_format($vatRate, 2, '.', ''));
        $cts = $doc->createElement('cac:TaxScheme');
        $this->cbc($doc, $cts, 'ID', 'VAT');
        $ctc->appendChild($cts);
        $item->appendChild($ctc);
        $il->appendChild($item);

        // Price
        $priceEl = $doc->createElement('cac:Price');
        $pa = $this->cbc($doc, $priceEl, 'PriceAmount', number_format($price, 2, '.', ''));
        $pa->setAttribute('currencyID', $cur);
        $bq = $this->cbc($doc, $priceEl, 'BaseQuantity', '1');
        $bq->setAttribute('unitCode', 'PCE');

        if ($discount > 0) {
            $ac = $doc->createElement('cac:AllowanceCharge');
            $this->cbc($doc, $ac, 'ChargeIndicator', 'false');
            $this->cbc($doc, $ac, 'AllowanceChargeReason', 'discount');
            $amt = $this->cbc($doc, $ac, 'Amount', number_format($discount, 2, '.', ''));
            $amt->setAttribute('currencyID', $cur);
            $priceEl->appendChild($ac);
        }

        $il->appendChild($priceEl);
        $parent->appendChild($il);
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private function cbc(DOMDocument $doc, DOMElement $parent, string $localName, string $value): DOMElement
    {
        $prefix = str_contains($localName, ':') ? '' : 'cbc:';
        $el     = $doc->createElement($prefix . $localName);
        $el->textContent = $value;
        $parent->appendChild($el);
        return $el;
    }
}
