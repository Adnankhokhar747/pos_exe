<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Exceptions\LicenseBlockedError;
use Carbon\Carbon;

class LicenseMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        // Check tenant-level suspension first — this is the authoritative gate
        // set by CompaniesController::suspend, independent of subscription dates.
        $tenant = Tenant::where('id', $user->tenant_id)->first();
        if (!$tenant || $tenant->status === 'suspended') {
            throw new LicenseBlockedError('Your account has been suspended. Please contact your administrator.');
        }
        if ($tenant->status === 'cancelled') {
            throw new LicenseBlockedError('Your account has been cancelled.');
        }

        $sub = TenantSubscription::where('tenant_id', $user->tenant_id)->first();
        if (!$sub) {
            throw new LicenseBlockedError('No active subscription found.');
        }

        if ($sub->status === 'suspended' || $sub->status === 'cancelled') {
            throw new LicenseBlockedError("Subscription is {$sub->status}.");
        }

        if ($sub->status === 'active') {
            $now = Carbon::now();
            $expiry = Carbon::parse($sub->expiry_date);
            if ($now->gt($expiry)) {
                $graceDue = $expiry->copy()->addDays($sub->grace_period_days);
                if ($now->gt($graceDue)) {
                    $sub->update(['status' => 'expired']);
                    throw new LicenseBlockedError('Subscription has expired and grace period has ended.');
                }
            }
        }

        if ($sub->status === 'expired') {
            throw new LicenseBlockedError('Subscription has expired.');
        }

        return $next($request);
    }
}
