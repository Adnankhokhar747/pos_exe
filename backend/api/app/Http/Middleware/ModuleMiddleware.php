<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\TenantModule;
use App\Models\ModuleCatalog;
use App\Exceptions\ModuleBlockedError;
use Carbon\Carbon;

class ModuleMiddleware
{
    public function handle(Request $request, Closure $next, string $moduleCode)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $catalog = ModuleCatalog::where('code', $moduleCode)->first();
        if (!$catalog || !$catalog->is_active) {
            throw new ModuleBlockedError("Module '{$moduleCode}' does not exist or is inactive.");
        }

        $tenantModule = TenantModule::where('tenant_id', $user->tenant_id)
            ->where('module_id', $catalog->id)
            ->first();

        if (!$tenantModule || !$tenantModule->enabled) {
            throw new ModuleBlockedError("Module '{$moduleCode}' is not enabled for your account.");
        }

        if ($tenantModule->expiry_date) {
            $now = Carbon::now();
            $expiry = Carbon::parse($tenantModule->expiry_date);
            if ($now->gt($expiry)) {
                $graceDue = $expiry->copy()->addDays($tenantModule->grace_period_days);
                if ($now->gt($graceDue)) {
                    $tenantModule->update(['enabled' => false]);
                    throw new ModuleBlockedError("Module '{$moduleCode}' has expired.");
                }
            }
        }

        return $next($request);
    }
}
