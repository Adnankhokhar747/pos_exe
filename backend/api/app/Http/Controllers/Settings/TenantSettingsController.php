<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenantSettingsController extends Controller
{
    public function get(Request $request)
    {
        $tenant = DB::table('tenants')
            ->where('id', $request->user()->tenant_id)
            ->first(['id','name','base_currency','address','tax_number','logo_path','default_tax_template_id']);

        if (!$tenant) {
            return response()->json(['error' => 'not_found', 'message' => 'Tenant not found.'], 404);
        }

        return response()->json([
            'id'                   => $tenant->id,
            'name'                 => $tenant->name,
            'baseCurrency'         => $tenant->base_currency,
            'address'              => $tenant->address,
            'taxNumber'            => $tenant->tax_number,
            'logoPath'             => $tenant->logo_path,
            'defaultTaxTemplateId' => $tenant->default_tax_template_id,
        ]);
    }

    public function update(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $data = array_filter([
            'name'                    => $request->name,
            'base_currency'           => $request->baseCurrency,
            'address'                 => $request->address,
            'tax_number'              => $request->taxNumber,
            'logo_path'               => $request->logoPath,
            'default_tax_template_id' => $request->defaultTaxTemplateId,
        ], fn($v) => $v !== null);

        if (!empty($data)) {
            DB::table('tenants')->where('id', $tenantId)->update($data);
        }

        $tenant = DB::table('tenants')
            ->where('id', $tenantId)
            ->first(['id','name','base_currency','address','tax_number','logo_path','default_tax_template_id']);

        return response()->json([
            'id'                   => $tenant->id,
            'name'                 => $tenant->name,
            'baseCurrency'         => $tenant->base_currency,
            'address'              => $tenant->address,
            'taxNumber'            => $tenant->tax_number,
            'logoPath'             => $tenant->logo_path,
            'defaultTaxTemplateId' => $tenant->default_tax_template_id,
        ]);
    }
}
