<?php

namespace App\Http\Controllers\EInvoice;

use App\Http\Controllers\Controller;
use App\Models\EInvoiceSettings;
use App\Services\EInvoice\EInvoiceSignerService;
use App\Services\EInvoice\ZatcaApiService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Handles ZATCA Phase 2 onboarding lifecycle:
 *   POST /einvoice/onboarding/generate-key   — generate EC key + CSR
 *   POST /einvoice/onboarding/submit-otp     — exchange CSR + OTP for CCSID
 *   POST /einvoice/onboarding/compliance     — run 3-invoice compliance check
 *   POST /einvoice/onboarding/activate       — exchange CCSID for PCSID (go live)
 *   GET  /einvoice/onboarding/status         — current onboarding state
 */
class EInvoiceCertController extends Controller
{
    public function __construct(private readonly EInvoiceSignerService $signer) {}

    // ── GET /einvoice/onboarding/status ──────────────────────────────────────

    public function status(Request $request): array
    {
        $settings = $this->getSettings($request);
        return $this->buildStatusResponse($settings);
    }

    // ── POST /einvoice/onboarding/generate-key ───────────────────────────────

    public function generateKey(Request $request)
    {
        $settings = $this->getSettings($request);

        $privateKey = $this->signer->generatePrivateKey();
        $csrBase64  = $this->signer->generateCsr($privateKey, [
            'name'       => $settings->seller_name_en ?? $settings->seller_name_ar ?? 'Company',
            'vat_number' => $settings->vat_number ?? '',
        ]);

        $settings->update([
            'private_key'       => $privateKey,
            'csr'               => $csrBase64,
            'onboarding_status' => 'key_generated',
            // Reset downstream state if re-generating
            'certificate'  => null,
            'ccsid_token'  => null,
            'ccsid_secret' => null,
            'pcsid_token'  => null,
            'pcsid_secret' => null,
        ]);

        return response()->json([
            'onboardingStatus' => 'key_generated',
            'csr'              => $csrBase64,
            'message'          => 'EC key pair generated. Download the CSR and use it in the ZATCA Fatoorah portal to obtain an OTP.',
        ]);
    }

    // ── POST /einvoice/onboarding/submit-otp ────────────────────────────────

    public function submitOtp(Request $request)
    {
        $request->validate(['otp' => 'required|string|min:4']);
        $settings = $this->getSettings($request);

        if (empty($settings->csr)) {
            return response()->json(['message' => 'Generate a key first.'], 422);
        }

        $api = new ZatcaApiService($settings->zatca_env ?? 'sandbox');

        try {
            $result = $api->onboard($settings->csr, $request->otp);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'ZATCA API error: ' . $e->getMessage()], 502);
        }

        // The token is base64-encoded DER certificate — decode to get PEM
        $certDer = base64_decode($result['binarySecurityToken']);
        $certPem = "-----BEGIN CERTIFICATE-----\n"
            . chunk_split(base64_encode($certDer), 64, "\n")
            . "-----END CERTIFICATE-----\n";

        $settings->update([
            'certificate'       => $certPem,
            'ccsid_token'       => $result['binarySecurityToken'],
            'ccsid_secret'      => $result['secret'],
            'onboarding_status' => 'compliance_pending',
        ]);

        return response()->json([
            'onboardingStatus' => 'compliance_pending',
            'message'          => 'CCSID obtained. Run the compliance check to proceed.',
        ]);
    }

    // ── POST /einvoice/onboarding/compliance ─────────────────────────────────

    /**
     * Generate 3 sample invoices and submit them for ZATCA compliance check.
     * ZATCA requires passing 3 valid invoices before issuing a PCSID.
     */
    public function runCompliance(Request $request)
    {
        $settings = $this->getSettings($request);

        if ($settings->onboarding_status !== 'compliance_pending') {
            return response()->json(['message' => 'Submit OTP first.'], 422);
        }

        $api     = new ZatcaApiService($settings->zatca_env ?? 'sandbox');
        $builder = app(\App\Services\EInvoice\EInvoiceXmlBuilder::class);
        $results = [];

        // Generate 3 minimal sample invoices
        for ($i = 1; $i <= 3; $i++) {
            $uuid = (string) Str::uuid();
            $xml  = $builder->build([
                'invoice_type'          => 'simplified',
                'invoice_number'        => "COMP-{$i}",
                'uuid'                  => $uuid,
                'issue_date'            => now()->format('Y-m-d'),
                'issue_time'            => now()->format('H:i:s'),
                'invoice_counter'       => $i,
                'previous_invoice_hash' => 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjhhED0tMTU5OTMzMzg2Mw==',
                'currency'              => 'SAR',
                'payment_means_code'    => '10',
                'qr_placeholder'        => '',
                'seller' => [
                    'name'            => $settings->seller_name_en ?? 'Test Seller',
                    'vat_number'      => $settings->vat_number ?? '300000000000003',
                    'cr_number'       => $settings->cr_number ?? '',
                    'building_number' => $settings->building_number ?? '1234',
                    'street_name'     => $settings->street_name ?? 'Test Street',
                    'district'        => $settings->district ?? 'Test District',
                    'city'            => $settings->city ?? 'Riyadh',
                    'postal_code'     => $settings->postal_code ?? '12345',
                    'country_code'    => $settings->country_code ?? 'SA',
                ],
                'buyer'         => ['name' => 'Test Customer'],
                'lines'         => [[
                    'name' => 'Test Item', 'quantity' => 1,
                    'unitPrice' => 100, 'discountValue' => 0, 'taxAmount' => 15,
                ]],
                'subtotal'       => 100,
                'discount_total' => 0,
                'tax_total'      => 15,
                'grand_total'    => 115,
                'vat_rate'       => (float)($settings->vat_rate ?? 15),
            ]);

            $signed  = app(\App\Services\EInvoice\EInvoiceSignerService::class)->signXml(
                $xml, $settings->private_key, $settings->certificate, now()->toIso8601String()
            );

            $result = $api->complianceCheck(
                $settings->ccsid_token,
                $settings->ccsid_secret,
                $signed['signed_xml'],
                $signed['invoice_hash'],
                $uuid,
                'simplified'
            );

            $results[] = ['invoice' => $i, 'status' => $result['status'], 'body' => $result['body']];
        }

        $allPassed = collect($results)->every(fn($r) => $r['status'] < 300);

        if ($allPassed) {
            $settings->update(['onboarding_status' => 'compliance_done']);
        }

        return response()->json([
            'onboardingStatus' => $allPassed ? 'compliance_done' : 'compliance_pending',
            'results'          => $results,
            'message'          => $allPassed
                ? 'Compliance check passed. Activate production to go live.'
                : 'Some invoices failed compliance. Check results.',
        ]);
    }

    // ── POST /einvoice/onboarding/activate ───────────────────────────────────

    public function activateProduction(Request $request)
    {
        $settings = $this->getSettings($request);

        if (!in_array($settings->onboarding_status, ['compliance_done', 'production_live'])) {
            return response()->json(['message' => 'Complete the compliance check first.'], 422);
        }

        $api = new ZatcaApiService($settings->zatca_env ?? 'sandbox');

        try {
            $result = $api->getProductionCsid($settings->ccsid_token, $settings->ccsid_secret);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'ZATCA API error: ' . $e->getMessage()], 502);
        }

        $settings->update([
            'pcsid_token'       => $result['binarySecurityToken'],
            'pcsid_secret'      => $result['secret'],
            'onboarding_status' => 'production_live',
        ]);

        return response()->json([
            'onboardingStatus' => 'production_live',
            'message'          => 'Production CSID obtained. E-invoicing is now live with ZATCA.',
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function getSettings(Request $request): EInvoiceSettings
    {
        $tenantId = $request->user()->tenant_id;
        return EInvoiceSettings::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['id' => (string) Str::uuid(), 'tenant_id' => $tenantId]
        );
    }

    private function buildStatusResponse(EInvoiceSettings $s): array
    {
        return [
            'onboardingStatus' => $s->onboarding_status ?? 'none',
            'hasCsr'           => !empty($s->csr),
            'hasCertificate'   => !empty($s->certificate),
            'hasCcsid'         => !empty($s->ccsid_token),
            'hasPcsid'         => !empty($s->pcsid_token),
            'invoiceCounter'   => $s->invoice_counter ?? 0,
            'zatcaEnv'         => $s->zatca_env ?? 'sandbox',
        ];
    }
}
