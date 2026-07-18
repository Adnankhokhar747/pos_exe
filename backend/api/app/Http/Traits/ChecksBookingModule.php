<?php

namespace App\Http\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

trait ChecksBookingModule
{
    protected function bookingModuleCheck(string $tenantId): ?JsonResponse
    {
        $enabled = DB::table('tenant_modules')
            ->join('module_catalog', 'tenant_modules.module_id', '=', 'module_catalog.id')
            ->where('tenant_modules.tenant_id', $tenantId)
            ->where('module_catalog.code', 'booking')
            ->where('tenant_modules.enabled', true)
            ->exists();

        if (!$enabled) {
            return response()->json([
                'error'   => 'module_disabled',
                'message' => 'Online booking is not available for this clinic.',
            ], 403);
        }

        return null; // null = module active, caller continues
    }
}
