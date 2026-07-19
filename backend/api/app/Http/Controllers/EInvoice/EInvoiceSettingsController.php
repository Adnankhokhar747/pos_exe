<?php

namespace App\Http\Controllers\EInvoice;

use App\Http\Controllers\Controller;
use App\Models\EInvoiceSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EInvoiceSettingsController extends Controller
{
    public function show(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $settings = EInvoiceSettings::where('tenant_id', $tenantId)->first();

        if (!$settings) {
            return response()->json([
                'id'               => null,
                'tenantId'         => $tenantId,
                'isActive'         => false,
                'sellerNameAr'     => null,
                'sellerNameEn'     => null,
                'vatNumber'        => null,
                'crNumber'         => null,
                'buildingNumber'   => null,
                'streetName'       => null,
                'district'         => null,
                'city'             => null,
                'postalCode'       => null,
                'countryCode'      => 'SA',
                'vatRate'          => '15.00',
                'phase'            => 1,
                'onboardingStatus' => 'none',
                'hasCsr'           => false,
                'hasCertificate'   => false,
                'hasCcsid'         => false,
                'hasPcsid'         => false,
                'invoiceCounter'   => 0,
                'zatcaEnv'         => 'sandbox',
            ]);
        }

        // Merge Phase 2 status fields (never expose private_key, secrets)
        $data                    = $settings->toArray();
        $data['onboardingStatus'] = $settings->onboarding_status ?? 'none';
        $data['hasCsr']           = !empty($settings->csr);
        $data['hasCertificate']   = !empty($settings->certificate);
        $data['hasCcsid']         = !empty($settings->ccsid_token);
        $data['hasPcsid']         = !empty($settings->pcsid_token);
        $data['invoiceCounter']   = $settings->invoice_counter ?? 0;
        $data['zatcaEnv']         = $settings->zatca_env ?? 'sandbox';

        return response()->json($data);
    }

    public function update(Request $request)
    {
        $request->validate([
            'vatNumber'  => 'nullable|string|max:15',
            'vatRate'    => 'nullable|numeric|min:0|max:100',
            'phase'      => 'nullable|integer|in:1,2',
            'countryCode'=> 'nullable|string|max:2',
            'zatcaEnv'   => 'nullable|string|in:sandbox,production',
        ]);

        $tenantId = $request->user()->tenant_id;

        $data = array_filter([
            'is_active'      => $request->has('isActive') ? (bool)$request->isActive : null,
            'seller_name_ar' => $request->sellerNameAr,
            'seller_name_en' => $request->sellerNameEn,
            'vat_number'     => $request->vatNumber,
            'cr_number'      => $request->crNumber,
            'building_number'=> $request->buildingNumber,
            'street_name'    => $request->streetName,
            'district'       => $request->district,
            'city'           => $request->city,
            'postal_code'    => $request->postalCode,
            'country_code'   => $request->countryCode,
            'vat_rate'       => $request->vatRate,
            'phase'          => $request->phase,
            'zatca_env'      => $request->zatcaEnv,
        ], fn($v) => $v !== null);

        $settings = EInvoiceSettings::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['id' => (string) Str::uuid(), 'tenant_id' => $tenantId]
        );

        $settings->update($data);

        return $settings->fresh();
    }
}
