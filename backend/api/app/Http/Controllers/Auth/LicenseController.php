<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\TenantSubscription;
use App\Models\Branch;
use App\Models\User;
use App\Models\Invoice;
use Carbon\Carbon;

class LicenseController extends Controller
{
    public function status(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $sub = TenantSubscription::with('plan')
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$sub) {
            return response()->json([
                'tenantActive'       => false,
                'subscriptionStatus' => 'none',
                'daysUntilExpiry'    => null,
                'inGracePeriod'      => false,
                'blocked'            => true,
                'warningLevel'       => 'critical',
                'message'            => 'No active subscription found.',
                'userLimit'          => null,
                'userCount'          => 0,
                'invoiceLimit'       => null,
                'invoiceCount'       => 0,
                'branchLimit'        => null,
                'branchCount'        => 0,
            ]);
        }

        $now    = Carbon::now();
        $expiry = Carbon::parse($sub->expiry_date);
        $daysUntilExpiry = (int) $now->diffInDays($expiry, false);

        $inGracePeriod = false;
        $blocked       = false;

        if ($daysUntilExpiry < 0) {
            $graceDue      = $expiry->copy()->addDays($sub->grace_period_days ?? 7);
            $inGracePeriod = $now->lte($graceDue);
            $blocked       = !$inGracePeriod;
        }

        $warningLevel = 'none';
        if ($blocked) {
            $warningLevel = 'critical';
        } elseif ($inGracePeriod) {
            $warningLevel = 'warning';
        } elseif ($daysUntilExpiry <= 14) {
            $warningLevel = 'warning';
        }

        $plan = $sub->plan;

        // Usage counts
        $branchCount  = Branch::where('tenant_id', $tenantId)->count();
        $userCount    = User::where('tenant_id', $tenantId)->where('status', 'active')->count();
        $branchIds    = Branch::where('tenant_id', $tenantId)->pluck('id');
        $invoiceCount = Invoice::whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->where('invoice_type', 'sale')
            ->count();

        return response()->json([
            'tenantActive'       => $sub->status === 'active',
            'subscriptionStatus' => $sub->status,
            'daysUntilExpiry'    => $daysUntilExpiry,
            'inGracePeriod'      => $inGracePeriod,
            'blocked'            => $blocked,
            'warningLevel'       => $warningLevel,
            'message'            => $blocked
                ? 'Your subscription has expired. Please renew to continue.'
                : ($inGracePeriod ? 'Subscription expired — grace period active.' : null),
            'userLimit'          => $plan?->user_limit,
            'userCount'          => $userCount,
            'invoiceLimit'       => $plan?->invoice_limit,
            'invoiceCount'       => $invoiceCount,
            'branchLimit'        => $plan?->branch_limit,
            'branchCount'        => $branchCount,
        ]);
    }
}
