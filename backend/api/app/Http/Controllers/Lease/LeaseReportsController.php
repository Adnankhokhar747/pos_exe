<?php

namespace App\Http\Controllers\Lease;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\LeaseAgreement;
use App\Models\LeasePayment;
use Carbon\Carbon;

class LeaseReportsController extends Controller
{
    public function summary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $today    = Carbon::today()->toDateString();

        $agreements = LeaseAgreement::where('tenant_id', $tenantId)->get();

        $active     = $agreements->where('status', 'active')->count();
        $pending    = $agreements->where('status', 'pending')->count();
        $terminated = $agreements->whereIn('status', ['terminated', 'expired'])->count();

        // Expiring in next 30 days
        $expiringSoon = $agreements->where('status', 'active')
            ->filter(fn($a) => $a->end_date && $a->end_date->gte(Carbon::today()) && $a->end_date->lte(Carbon::today()->addDays(30)))
            ->count();

        // Total rent collected
        $totalCollected = LeasePayment::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->sum('amount');

        // Overdue payments (due_date passed, not paid)
        $overdue = LeasePayment::where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->where('due_date', '<', $today)
            ->count();

        // Monthly revenue (current month)
        $monthStart = Carbon::today()->startOfMonth()->toDateString();
        $monthEnd   = Carbon::today()->endOfMonth()->toDateString();
        $monthlyRevenue = LeasePayment::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereBetween('paid_date', [$monthStart, $monthEnd])
            ->sum('amount');

        return response()->json([
            'activeLeases'    => $active,
            'pendingLeases'   => $pending,
            'terminatedLeases'=> $terminated,
            'expiringSoon'    => $expiringSoon,
            'totalCollected'  => $totalCollected,
            'overduePayments' => $overdue,
            'monthlyRevenue'  => $monthlyRevenue,
        ]);
    }

    public function expiring(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $days     = (int) $request->input('days', 30);

        $agreements = LeaseAgreement::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->whereBetween('end_date', [Carbon::today()->toDateString(), Carbon::today()->addDays($days)->toDateString()])
            ->with(['property:id,name,type', 'customer:id,name,phone'])
            ->orderBy('end_date')
            ->get()
            ->map(fn($a) => [
                'id'           => $a->id,
                'property'     => $a->property ? ['id' => $a->property->id, 'name' => $a->property->name, 'type' => $a->property->type] : null,
                'customer'     => $a->customer ? ['id' => $a->customer->id, 'name' => $a->customer->name, 'phone' => $a->customer->phone] : null,
                'endDate'      => $a->end_date?->toDateString(),
                'rentAmount'   => $a->rent_amount,
                'rentFrequency'=> $a->rent_frequency,
                'daysLeft'     => Carbon::today()->diffInDays($a->end_date, false),
            ]);

        return response()->json($agreements);
    }

    public function payments(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $request->validate([
            'from' => 'nullable|date',
            'to'   => 'nullable|date',
        ]);

        $from = $request->input('from', Carbon::today()->startOfMonth()->toDateString());
        $to   = $request->input('to',   Carbon::today()->endOfMonth()->toDateString());

        $payments = LeasePayment::where('tenant_id', $tenantId)
            ->whereBetween('paid_date', [$from, $to])
            ->where('status', 'paid')
            ->with(['lease.property:id,name', 'lease.customer:id,name'])
            ->orderByDesc('paid_date')
            ->get()
            ->map(fn($p) => [
                'id'            => $p->id,
                'amount'        => $p->amount,
                'paidDate'      => $p->paid_date?->toDateString(),
                'periodStart'   => $p->period_start?->toDateString(),
                'periodEnd'     => $p->period_end?->toDateString(),
                'paymentMethod' => $p->payment_method,
                'property'      => $p->lease?->property ? ['name' => $p->lease->property->name] : null,
                'customer'      => $p->lease?->customer ? ['name' => $p->lease->customer->name] : null,
            ]);

        return response()->json($payments);
    }
}
