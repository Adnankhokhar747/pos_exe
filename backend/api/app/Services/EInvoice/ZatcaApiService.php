<?php

namespace App\Services\EInvoice;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * ZATCA Fatoorah API client.
 *
 * Sandbox base: https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal
 * Production:   https://gw-apic-gov.gazt.gov.sa/e-invoicing/core
 */
class ZatcaApiService
{
    private const SANDBOX    = 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal';
    private const PRODUCTION = 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/core';

    private string $base;

    public function __construct(string $env = 'sandbox')
    {
        $this->base = $env === 'production' ? self::PRODUCTION : self::SANDBOX;
    }

    // ── Onboarding ───────────────────────────────────────────────────────────

    /**
     * Submit CSR + OTP to ZATCA to obtain Compliance CSID (CCSID).
     *
     * @param string $csrBase64 Base64-encoded DER CSR
     * @param string $otp       6-digit OTP from Fatoorah portal
     * @return array{binarySecurityToken: string, secret: string, requestID: string}
     */
    public function onboard(string $csrBase64, string $otp): array
    {
        $response = Http::withHeaders([
            'OTP'          => $otp,
            'Content-Type' => 'application/json',
            'Accept'       => 'application/json',
        ])->post("{$this->base}/compliance", [
            'csr' => $csrBase64,
        ]);

        if (!$response->successful()) {
            throw new RuntimeException("ZATCA onboarding failed [{$response->status()}]: " . $response->body());
        }

        $body = $response->json();
        return [
            'binarySecurityToken' => $body['binarySecurityToken'] ?? '',
            'secret'              => $body['secret']              ?? '',
            'requestID'           => $body['requestID']           ?? '',
        ];
    }

    /**
     * Exchange CCSID for Production CSID (PCSID).
     *
     * @return array{binarySecurityToken: string, secret: string}
     */
    public function getProductionCsid(string $ccsidToken, string $ccsidSecret): array
    {
        $response = Http::withBasicAuth(base64_decode($ccsidToken), $ccsidSecret)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ])
            ->post("{$this->base}/production/csids", [
                'compliance_request_id' => '',
            ]);

        if (!$response->successful()) {
            throw new RuntimeException("PCSID request failed [{$response->status()}]: " . $response->body());
        }

        $body = $response->json();
        return [
            'binarySecurityToken' => $body['binarySecurityToken'] ?? '',
            'secret'              => $body['secret']              ?? '',
        ];
    }

    // ── Compliance check ─────────────────────────────────────────────────────

    /**
     * Submit a sample signed invoice XML for compliance verification.
     *
     * @return array{reportingStatus: string, validationResults: array}
     */
    public function complianceCheck(
        string $ccsidToken,
        string $ccsidSecret,
        string $signedXml,
        string $invoiceHash,
        string $uuid,
        string $invoiceType // 'simplified' or 'standard'
    ): array {
        $invoiceB64 = base64_encode($signedXml);

        $response = Http::withBasicAuth(base64_decode($ccsidToken), $ccsidSecret)
            ->withHeaders([
                'Content-Type'        => 'application/json',
                'Accept'              => 'application/json',
                'Clearance-Status'    => $invoiceType === 'standard' ? '1' : '0',
            ])
            ->post("{$this->base}/compliance/invoices", [
                'invoiceHash'    => $invoiceHash,
                'uuid'           => $uuid,
                'invoice'        => $invoiceB64,
            ]);

        return [
            'status'            => $response->status(),
            'body'              => $response->json() ?? [],
            'validationResults' => $response->json('validationResults') ?? [],
        ];
    }

    // ── Invoice submission ───────────────────────────────────────────────────

    /**
     * Report a simplified (B2C) invoice to ZATCA.
     * Returns the reporting status and any warnings.
     */
    public function reportInvoice(
        string $pcsidToken,
        string $pcsidSecret,
        string $signedXml,
        string $invoiceHash,
        string $uuid
    ): array {
        $response = Http::withBasicAuth(base64_decode($pcsidToken), $pcsidSecret)
            ->withHeaders([
                'Content-Type'        => 'application/json',
                'Accept'              => 'application/json',
                'Clearance-Status'    => '0',
            ])
            ->post("{$this->base}/invoices/reporting/single", [
                'invoiceHash' => $invoiceHash,
                'uuid'        => $uuid,
                'invoice'     => base64_encode($signedXml),
            ]);

        return [
            'status'          => $response->status(),
            'reportingStatus' => $response->json('reportingStatus') ?? 'UNKNOWN',
            'body'            => $response->json() ?? [],
        ];
    }

    /**
     * Submit a standard (B2B) invoice for clearance.
     * Returns the cleared XML (with ZATCA stamp) and QR code.
     */
    public function clearInvoice(
        string $pcsidToken,
        string $pcsidSecret,
        string $signedXml,
        string $invoiceHash,
        string $uuid
    ): array {
        $response = Http::withBasicAuth(base64_decode($pcsidToken), $pcsidSecret)
            ->withHeaders([
                'Content-Type'        => 'application/json',
                'Accept'              => 'application/json',
                'Clearance-Status'    => '1',
            ])
            ->post("{$this->base}/invoices/clearance/single", [
                'invoiceHash' => $invoiceHash,
                'uuid'        => $uuid,
                'invoice'     => base64_encode($signedXml),
            ]);

        $body = $response->json() ?? [];

        // ZATCA returns the cleared invoice as base64 in the response
        $clearedXml = isset($body['clearedInvoice'])
            ? base64_decode($body['clearedInvoice'])
            : $signedXml;

        return [
            'status'         => $response->status(),
            'clearanceStatus'=> $body['clearanceStatus'] ?? 'UNKNOWN',
            'clearedXml'     => $clearedXml,
            'qrCode'         => $body['reportingStatus'] ?? null,
            'body'           => $body,
        ];
    }
}
