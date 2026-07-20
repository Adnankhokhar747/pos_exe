<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\HrExpenseClaim;
use App\Models\HrExpenseClaimItem;
use App\Models\HrEmployee;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class HrExpenseClaimsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        return HrExpenseClaim::where('tenant_id', $tenantId)
            ->when($request->employeeId, fn($q, $e) => $q->where('employee_id', $e))
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->when($request->month, fn($q, $m) => $q->where('period_month', $m))
            ->when($request->year, fn($q, $y) => $q->where('period_year', $y))
            ->with('employee:id,name,employee_code,department')
            ->with('items')
            ->orderByDesc('created_at')
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'employeeId'  => 'required|uuid',
            'periodMonth' => 'required|integer|min:1|max:12',
            'periodYear'  => 'required|integer|min:2020|max:2100',
            'description' => 'nullable|string|max:255',
            'notes'       => 'nullable|string',
            'items'       => 'required|array|min:1',
            'items.*.expenseDate'  => 'required|date',
            'items.*.category'     => 'required|string|max:100',
            'items.*.description'  => 'nullable|string|max:255',
            'items.*.amount'       => 'required|numeric|min:0.01',
            'items.*.receiptRef'   => 'nullable|string|max:100',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Validate employee belongs to tenant
        $emp = HrEmployee::where('tenant_id', $tenantId)->find($request->employeeId);
        if (!$emp) throw new NotFoundException('Employee not found.');

        $total = collect($request->items)->sum('amount');

        $claim = HrExpenseClaim::create([
            'id'           => (string) Str::uuid(),
            'tenant_id'    => $tenantId,
            'employee_id'  => $request->employeeId,
            'period_month' => $request->periodMonth,
            'period_year'  => $request->periodYear,
            'description'  => $request->description,
            'total_amount' => $total,
            'notes'        => $request->notes,
        ]);

        foreach ($request->items as $line) {
            HrExpenseClaimItem::create([
                'id'           => (string) Str::uuid(),
                'claim_id'     => $claim->id,
                'expense_date' => $line['expenseDate'],
                'category'     => $line['category'],
                'description'  => $line['description'] ?? null,
                'amount'       => $line['amount'],
                'receipt_ref'  => $line['receiptRef'] ?? null,
            ]);
        }

        return response()->json($claim->load(['items', 'employee:id,name,employee_code']), 201);
    }

    public function show(Request $request, string $id)
    {
        $claim = HrExpenseClaim::where('tenant_id', $request->user()->tenant_id)
            ->with(['items', 'employee:id,name,employee_code,department'])
            ->find($id);
        if (!$claim) throw new NotFoundException("Claim {$id} not found.");
        return $claim;
    }

    public function submit(Request $request, string $id)
    {
        $claim = HrExpenseClaim::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$claim) throw new NotFoundException("Claim {$id} not found.");
        if ($claim->status !== 'draft') throw new ConflictException('Only draft claims can be submitted.');
        $claim->update(['status' => 'submitted']);
        return $claim;
    }

    public function approve(Request $request, string $id)
    {
        $claim = HrExpenseClaim::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$claim) throw new NotFoundException("Claim {$id} not found.");
        if ($claim->status !== 'submitted') throw new ConflictException('Only submitted claims can be approved.');

        $claim->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);
        return $claim;
    }

    public function reject(Request $request, string $id)
    {
        $claim = HrExpenseClaim::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$claim) throw new NotFoundException("Claim {$id} not found.");
        if (!in_array($claim->status, ['submitted', 'approved'])) throw new ConflictException('Cannot reject this claim.');

        $claim->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
        ]);
        return $claim;
    }

    public function destroy(Request $request, string $id)
    {
        $claim = HrExpenseClaim::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$claim) throw new NotFoundException("Claim {$id} not found.");
        if (!in_array($claim->status, ['draft', 'rejected'])) throw new ConflictException('Only draft or rejected claims can be deleted.');

        HrExpenseClaimItem::where('claim_id', $id)->delete();
        $claim->delete();
        return response()->json(null, 204);
    }
}
