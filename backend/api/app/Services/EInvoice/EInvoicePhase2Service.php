<?php

namespace App\Services\EInvoice;

use App\Models\EInvoiceSettings;
use App\Models\Invoice;
use App\Models\Customer;
use Illuminate\Support\Str;

/**
 * Orchestrates the full ZATCA Phase 2 invoice flow:
 *   1. Build UBL 2.1 XML
 *   2. Sign with EC key
 *   3. Submit to ZATCA (reporting for B2C, clearance for B2B)
 *   4. Store results + return QR code
 */
class EInvoicePhase2Service
{
    public function __construct(
        private readonly EInvoiceXmlBuilder   $builder,
        private readonly EInvoiceSignerService $signer,
    ) {}

    /**
     * Process a completed invoice through ZATCA Phase 2.
     *
     * @return array{qr: string, status: string, hash: string}
     */
    public function process(Invoice $invoice, EInvoiceSettings $settings): array
    {
        // ── Determine B2B vs B2C ─────────────────────────────────────────────
        $customer   = $invoice->customer;
        $isStandard = !empty($customer?->tax_number); // has VAT = B2B clearance

        // ── Invoice type (sale or return/credit note) ────────────────────────
        $invoiceType = match(true) {
            $invoice->invoice_type === 'return' => 'credit_note',
            $isStandard                         => 'standard',
            default                             => 'simplified',
        };

        // ── Increment counter atomically ─────────────────────────────────────
        $settings->increment('invoice_counter');
        $settings->refresh();
        $counter = $settings->invoice_counter;

        // ── PIH: previous invoice hash (first invoice uses a ZATCA-defined default) ──
        $pih = $settings->last_invoice_hash
            ?? 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjhhED0tMTU5OTMzMzg2Mw==';

        // ── Build XML ────────────────────────────────────────────────────────
        $issueDate = $invoice->created_at->format('Y-m-d');
        $issueTime = $invoice->created_at->format('H:i:s');

        $xml = $this->builder->build([
            'invoice_type'          => $invoiceType,
            'invoice_number'        => $invoice->invoice_no,
            'uuid'                  => $invoice->einvoice_uuid ?? (string) Str::uuid(),
            'issue_date'            => $issueDate,
            'issue_time'            => $issueTime,
            'invoice_counter'       => $counter,
            'previous_invoice_hash' => $pih,
            'currency'              => $invoice->currency_code ?? 'SAR',
            'payment_means_code'    => $this->paymentMeansCode($invoice),
            'qr_placeholder'        => '',
            'seller'                => [
                'name'            => $settings->seller_name_en ?? $settings->seller_name_ar ?? '',
                'vat_number'      => $settings->vat_number     ?? '',
                'cr_number'       => $settings->cr_number       ?? '',
                'building_number' => $settings->building_number ?? '',
                'street_name'     => $settings->street_name     ?? '',
                'district'        => $settings->district         ?? '',
                'city'            => $settings->city             ?? '',
                'postal_code'     => $settings->postal_code      ?? '',
                'country_code'    => $settings->country_code     ?? 'SA',
            ],
            'buyer' => [
                'name'            => $customer?->name           ?? 'Customer',
                'vat_number'      => $customer?->tax_number     ?? null,
                'building_number' => $customer?->building_number ?? null,
                'street_name'     => $customer?->street_name    ?? null,
                'district'        => $customer?->district        ?? null,
                'city'            => $customer?->city            ?? null,
                'postal_code'     => $customer?->postal_code     ?? null,
                'country_code'    => $customer?->country_code    ?? 'SA',
            ],
            'lines'         => $invoice->lines->map(fn($l) => [
                'name'          => $l->product?->name ?? 'Item',
                'quantity'      => $l->quantity,
                'unitPrice'     => $l->unit_price,
                'discountValue' => $l->discount_value,
                'taxAmount'     => $l->tax_amount,
            ])->toArray(),
            'subtotal'      => (float)$invoice->subtotal,
            'discount_total'=> (float)$invoice->discount_total,
            'tax_total'     => (float)$invoice->tax_total,
            'grand_total'   => (float)$invoice->grand_total,
            'vat_rate'      => (float)($settings->vat_rate ?? 15),
        ]);

        // ── Sign ─────────────────────────────────────────────────────────────
        $signed = $this->signer->signXml(
            $xml,
            $settings->private_key,
            $settings->certificate,
            now()->toIso8601String()
        );

        $signedXml   = $signed['signed_xml'];
        $invoiceHash = $signed['invoice_hash'];

        // ── Generate Phase 2 QR (for B2C; B2B QR comes from ZATCA response) ──
        $qr = $this->signer->generatePhase2Qr(
            $settings->seller_name_en ?? $settings->seller_name_ar ?? '',
            $settings->vat_number     ?? '',
            $invoice->created_at->toIso8601String(),
            number_format((float)$invoice->grand_total, 2, '.', ''),
            number_format((float)$invoice->tax_total,   2, '.', ''),
            $invoiceHash
        );

        // ── Submit to ZATCA ──────────────────────────────────────────────────
        $zatcaStatus = 'pending';
        $zatcaBody   = null;

        if ($settings->pcsid_token && $settings->pcsid_secret) {
            $api = new ZatcaApiService($settings->zatca_env ?? 'sandbox');
            try {
                if ($isStandard && $invoiceType !== 'credit_note') {
                    $result = $api->clearInvoice(
                        $settings->pcsid_token,
                        $settings->pcsid_secret,
                        $signedXml,
                        $invoiceHash,
                        $invoice->einvoice_uuid ?? ''
                    );
                    $zatcaStatus = strtolower($result['clearanceStatus']) === 'cleared' ? 'cleared' : 'failed';
                    // B2B: use cleared XML and ZATCA-provided QR if available
                    if ($result['clearedXml']) {
                        $signedXml = $result['clearedXml'];
                    }
                    $zatcaBody = json_encode($result['body']);
                } else {
                    $result = $api->reportInvoice(
                        $settings->pcsid_token,
                        $settings->pcsid_secret,
                        $signedXml,
                        $invoiceHash,
                        $invoice->einvoice_uuid ?? ''
                    );
                    $zatcaStatus = strtolower($result['reportingStatus']) === 'reported' ? 'reported' : 'pending';
                    $zatcaBody   = json_encode($result['body']);
                }
            } catch (\Throwable $e) {
                $zatcaStatus = 'failed';
                $zatcaBody   = json_encode(['error' => $e->getMessage()]);
            }
        }

        // ── Persist on invoice ───────────────────────────────────────────────
        $invoice->update([
            'einvoice_xml'          => $xml,
            'einvoice_signed_xml'   => $signedXml,
            'einvoice_hash'         => $invoiceHash,
            'einvoice_counter'      => $counter,
            'einvoice_status'       => $zatcaStatus,
            'einvoice_zatca_response'=> $zatcaBody,
            'einvoice_qr'           => $qr,
        ]);

        // ── Update PIH chain ─────────────────────────────────────────────────
        $settings->update(['last_invoice_hash' => $invoiceHash]);

        return [
            'qr'     => $qr,
            'status' => $zatcaStatus,
            'hash'   => $invoiceHash,
        ];
    }

    private function paymentMeansCode(Invoice $invoice): string
    {
        $method = $invoice->payments->first()?->method ?? 'cash';
        return match($method) {
            'cash'          => '10',
            'debit_card',
            'credit_card'   => '48',
            'bank_transfer' => '30',
            'mobile_wallet' => '10',
            default         => '10',
        };
    }
}
