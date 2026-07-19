<?php

namespace App\Services;

class EInvoiceService
{
    /**
     * Generate a ZATCA Phase 1 TLV QR code string (Base64-encoded).
     *
     * Tag 1: Seller name
     * Tag 2: VAT registration number
     * Tag 3: Invoice date/time (ISO 8601)
     * Tag 4: Invoice total amount (with VAT)
     * Tag 5: VAT amount
     */
    public function generateTlvQr(
        string $sellerName,
        string $vatNumber,
        string $timestamp,
        string $totalWithVat,
        string $vatAmount
    ): string {
        $tlv = '';
        $tlv .= $this->tlvField(1, $sellerName);
        $tlv .= $this->tlvField(2, $vatNumber);
        $tlv .= $this->tlvField(3, $timestamp);
        $tlv .= $this->tlvField(4, $totalWithVat);
        $tlv .= $this->tlvField(5, $vatAmount);

        return base64_encode($tlv);
    }

    private function tlvField(int $tag, string $value): string
    {
        $bytes  = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
        $length = strlen($bytes);

        return chr($tag) . chr($length) . $bytes;
    }

    /**
     * Extract VAT from an inclusive total.
     * vatAmount = total * rate / (100 + rate)
     */
    public function extractVat(float $inclusiveTotal, float $vatRate = 15.0): float
    {
        return round($inclusiveTotal * $vatRate / (100.0 + $vatRate), 2);
    }
}
