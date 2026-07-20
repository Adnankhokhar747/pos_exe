<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrAdvance;
use App\Models\HrEmployee;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HrAdvancesController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $advances = HrAdvance::where('tenant_id', $tenantId)
            ->with('employee:id,name,employee_code,department')
            ->when($request->employeeId, fn($q, $v) => $q->where('employee_id', $v))
            ->when($request->status,     fn($q, $v) => $q->where('status', $v))
            ->orderByDesc('issued_date')
            ->get()
            ->map(fn($a) => $this->format($a));

        return response()->json($advances);
    }

    public function store(Request $request)
    {
        $request->validate([
            'employeeId'        => 'required|uuid',
            'amount'            => 'required|numeric|min:0.01',
            'deductionType'     => 'required|in:full_once,recurring',
            'monthlyInstallment'=> 'nullable|numeric|min:0.01',
            'issuedDate'        => 'required|date',
            'notes'             => 'nullable|string|max:1000',
        ]);

        $tenantId = $request->user()->tenant_id;
        HrEmployee::where('tenant_id', $tenantId)->findOrFail($request->employeeId);

        $amount      = (float) $request->amount;
        $installment = $request->deductionType === 'recurring'
            ? (float) ($request->monthlyInstallment ?? $amount)
            : null;

        $totalInstallments = ($installment && $installment > 0)
            ? (int) ceil($amount / $installment)
            : ($request->deductionType === 'full_once' ? 1 : null);

        $advance = HrAdvance::create([
            'id'                  => (string) Str::uuid(),
            'tenant_id'           => $tenantId,
            'employee_id'         => $request->employeeId,
            'amount'              => $amount,
            'remaining_balance'   => $amount,
            'deduction_type'      => $request->deductionType,
            'monthly_installment' => $installment,
            'total_installments'  => $totalInstallments,
            'installments_paid'   => 0,
            'status'              => 'active',
            'issued_date'         => $request->issuedDate,
            'notes'               => $request->notes,
            'created_by'          => $request->user()->id,
        ]);

        return response()->json($this->format($advance->load('employee:id,name,employee_code,department')), 201);
    }

    public function cancel(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $advance = HrAdvance::where('tenant_id', $tenantId)->findOrFail($id);

        if ($advance->status !== 'active') {
            return response()->json(['error' => 'invalid_status', 'message' => 'Only active advances can be cancelled.'], 422);
        }

        $advance->update(['status' => 'cancelled']);

        return response()->json($this->format($advance->fresh()->load('employee:id,name,employee_code,department')));
    }

    private function format(HrAdvance $a): array
    {
        return [
            'id'                  => $a->id,
            'tenantId'            => $a->tenant_id,
            'employeeId'          => $a->employee_id,
            'employeeName'        => $a->employee?->name,
            'employeeCode'        => $a->employee?->employee_code,
            'department'          => $a->employee?->department,
            'amount'              => (float) $a->amount,
            'remainingBalance'    => (float) $a->remaining_balance,
            'deductionType'       => $a->deduction_type,
            'monthlyInstallment'  => $a->monthly_installment !== null ? (float) $a->monthly_installment : null,
            'totalInstallments'   => $a->total_installments,
            'installmentsPaid'    => (int) $a->installments_paid,
            'status'              => $a->status,
            'issuedDate'          => $a->issued_date,
            'notes'               => $a->notes,
            'createdAt'           => $a->created_at?->toISOString(),
        ];
    }
}
