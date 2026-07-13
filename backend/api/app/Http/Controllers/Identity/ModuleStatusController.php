<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ModuleCatalog;
use App\Models\TenantModule;
use Carbon\Carbon;

class ModuleStatusController extends Controller
{
    public function status(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $catalogs = ModuleCatalog::where('is_active', true)->get();
        $grants   = TenantModule::where('tenant_id', $tenantId)->get()->keyBy('module_id');

        return $catalogs->map(function ($cat) use ($grants) {
            $grant = $grants->get($cat->id);
            $enabled = $grant && $grant->enabled;
            $blocked = !$enabled;
            $daysUntilExpiry = null;
            $inGracePeriod = false;

            if ($grant && $grant->expiry_date) {
                $now = Carbon::now();
                $expiry = Carbon::parse($grant->expiry_date);
                $daysUntilExpiry = (int) $now->diffInDays($expiry, false);
                if ($daysUntilExpiry < 0) {
                    $graceDue = $expiry->copy()->addDays($grant->grace_period_days);
                    $inGracePeriod = $now->lte($graceDue);
                    $blocked = !$inGracePeriod;
                }
            }

            return [
                'moduleCode'      => $cat->code,
                'name'            => $cat->name,
                'enabled'         => $enabled,
                'blocked'         => $blocked,
                'daysUntilExpiry' => $daysUntilExpiry,
                'inGracePeriod'   => $inGracePeriod,
                'expiryDate'      => $grant?->expiry_date,
                'limits'          => $grant?->limits,
            ];
        });
    }
}
