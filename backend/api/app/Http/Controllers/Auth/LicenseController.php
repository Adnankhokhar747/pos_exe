<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Tenant;
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

        // Check tenant-level status first — this is what CompaniesController::suspend writes.
        $tenant = Tenant::where('id', $tenantId)->first();
        if ($tenant && $tenant->status === 'suspended') {
            return response()->json([
                'tenantActive'       => false,
                'subscriptionStatus' => 'suspended',
                'daysUntilExpiry'    => null,
                'inGracePeriod'      => false,
                'blocked'            => true,
                'warningLevel'       => 'critical',
                'message'            => 'Your account has been suspended. Please contact your administrator to reactivate.',
                'userLimit'          => null,
                'userCount'          => 0,
                'invoiceLimit'       => null,
                'invoiceCount'       => 0,
                'branchLimit'        => null,
                'branchCount'        => 0,
            ]);
        }
        if ($tenant && $tenant->status === 'cancelled') {
            return response()->json([
                'tenantActive'       => false,
                'subscriptionStatus' => 'cancelled',
                'daysUntilExpiry'    => null,
                'inGracePeriod'      => false,
                'blocked'            => true,
                'warningLevel'       => 'critical',
                'message'            => 'Your account has been cancelled. Please contact your administrator.',
                'userLimit'          => null,
                'userCount'          => 0,
                'invoiceLimit'       => null,
                'invoiceCount'       => 0,
                'branchLimit'        => null,
                'branchCount'        => 0,
            ]);
        }

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
        $message       = null;

        // Suspended / cancelled — blocked regardless of expiry date
        if ($sub->status === 'suspended') {
            $blocked = true;
            $message = 'Your account has been suspended. Please contact your administrator to reactivate.';
        } elseif ($sub->status === 'cancelled') {
            $blocked = true;
            $message = 'Your subscription has been cancelled. Please contact your administrator.';
        } elseif ($sub->status === 'expired') {
            $blocked = true;
            $message = 'Your subscription has expired. Please renew to continue.';
        } elseif ($daysUntilExpiry < 0) {
            // Status is still 'active' but date has passed — compute grace
            $graceDue      = $expiry->copy()->addDays($sub->grace_period_days ?? 7);
            $inGracePeriod = $now->lte($graceDue);
            $blocked       = !$inGracePeriod;
            if ($blocked) {
                $message = 'Your subscription has expired and the grace period has ended. Please renew.';
            } else {
                $message = 'Subscription expired — grace period active. Please renew immediately.';
            }
        }

        $warningLevel = 'none';
        if ($blocked) {
            $warningLevel = 'critical';
        } elseif ($inGracePeriod) {
            $warningLevel = 'warning';
        } elseif ($daysUntilExpiry <= 3) {
            $warningLevel = 'critical';
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
            'message'            => $message,
            'userLimit'          => $plan?->user_limit,
            'userCount'          => $userCount,
            'invoiceLimit'       => $plan?->invoice_limit,
            'invoiceCount'       => $invoiceCount,
            'branchLimit'        => $plan?->branch_limit,
            'branchCount'        => $branchCount,
        ]);
    }
}
