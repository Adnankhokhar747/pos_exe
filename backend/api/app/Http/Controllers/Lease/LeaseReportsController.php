<?php

namespace App\Http\Controllers\Lease;

use App\Http\Controllers\Controller;
use App\Models\LeaseAgreement;
use App\Models\LeaseInstallment;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeaseReportsController extends Controller
{
    public function summary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $today    = Carbon::today()->toDateString();

        $agreements = LeaseAgreement::where('tenant_id', $tenantId)->get();

        $active    = $agreements->where('status', 'active')->count();
        $completed = $agreements->where('status', 'completed')->count();

        $totalFinanced = $agreements->sum('financed_amount');

        $installments = LeaseInstallment::where('tenant_id', $tenantId)->get();
        $totalCollected = $installments->where('status', 'paid')->sum('paid_amount');
        $totalPending   = $installments->whereIn('status', ['pending', 'partial', 'overdue'])->sum('amount');
        $overdue        = $installments->where('status', 'overdue')->count();

        $monthStart = Carbon::today()->startOfMonth()->toDateString();
        $monthEnd   = Carbon::today()->endOfMonth()->toDateString();
        $monthlyCollected = LeaseInstallment::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereBetween('paid_date', [$monthStart, $monthEnd])
            ->sum('paid_amount');

        return response()->json([
            'activeAgreements'    => $active,
            'completedAgreements' => $completed,
            'totalFinanced'       => (float) $totalFinanced,
            'totalCollected'      => (float) $totalCollected,
            'totalPending'        => (float) $totalPending,
            'overdueInstallments' => $overdue,
            'monthlyCollected'    => (float) $monthlyCollected,
        ]);
    }

    public function upcoming(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $days     = (int) $request->input('days', 30);

        $from = Carbon::today()->toDateString();
        $to   = Carbon::today()->addDays($days)->toDateString();

        $installments = LeaseInstallment::where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'overdue'])
            ->whereBetween('due_date', [$from, $to])
            ->with(['agreement.customer:id,name,phone'])
            ->orderBy('due_date')
            ->get()
            ->map(fn($i) => [
                'id'                => $i->id,
                'agreementId'       => $i->agreement_id,
                'agreementTitle'    => $i->agreement?->title,
                'category'          => $i->agreement?->category,
                'customerName'      => $i->agreement?->customer?->name,
                'customerPhone'     => $i->agreement?->customer?->phone,
                'installmentNumber' => $i->installment_number,
                'dueDate'           => $i->due_date?->toDateString(),
                'amount'            => (float) $i->amount,
                'status'            => $i->status,
                'daysUntilDue'      => Carbon::today()->diffInDays($i->due_date, false),
            ]);

        return response()->json($installments);
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

        $installments = LeaseInstallment::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereBetween('paid_date', [$from, $to])
            ->with(['agreement.customer:id,name'])
            ->orderByDesc('paid_date')
            ->get()
            ->map(fn($i) => [
                'id'                => $i->id,
                'agreementTitle'    => $i->agreement?->title,
                'category'          => $i->agreement?->category,
                'customerName'      => $i->agreement?->customer?->name,
                'installmentNumber' => $i->installment_number,
                'dueDate'           => $i->due_date?->toDateString(),
                'paidDate'          => $i->paid_date?->toDateString(),
                'amount'            => (float) $i->amount,
                'paidAmount'        => (float) $i->paid_amount,
                'paymentMethod'     => $i->payment_method,
                'referenceNumber'   => $i->reference_number,
            ]);

        return response()->json($installments);
    }
}
