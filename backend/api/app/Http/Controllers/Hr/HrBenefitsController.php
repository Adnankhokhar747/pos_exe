<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Models\HrBenefitType;
use App\Models\HrEmployeeBenefit;
use App\Models\HrTaxSetting;
use App\Models\HrEmployee;
use App\Exceptions\NotFoundException;

class HrBenefitsController extends Controller
{
    // ── Benefit Types ─────────────────────────────────────────────────────────

    public function listTypes(Request $request)
    {
        return HrBenefitType::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get();
    }

    public function storeType(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string',
            'isTaxable'   => 'boolean',
        ]);

        return response()->json(
            HrBenefitType::create([
                'id'          => (string) Str::uuid(),
                'tenant_id'   => $request->user()->tenant_id,
                'name'        => $request->name,
                'description' => $request->description,
                'is_taxable'  => $request->boolean('isTaxable', false),
            ]),
            201
        );
    }

    public function updateType(Request $request, string $id)
    {
        $type = HrBenefitType::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$type) throw new NotFoundException("Benefit type {$id} not found.");

        $request->validate([
            'name'        => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'isTaxable'   => 'boolean',
            'isActive'    => 'boolean',
        ]);

        $type->update(array_filter([
            'name'        => $request->name,
            'description' => $request->description,
            'is_taxable'  => $request->has('isTaxable') ? $request->boolean('isTaxable') : null,
            'is_active'   => $request->has('isActive')  ? $request->boolean('isActive')  : null,
        ], fn($v) => $v !== null));

        return $type;
    }

    // ── Employee Benefits ─────────────────────────────────────────────────────

    public function listEmployeeBenefits(Request $request, string $employeeId)
    {
        $emp = HrEmployee::where('tenant_id', $request->user()->tenant_id)->find($employeeId);
        if (!$emp) throw new NotFoundException("Employee {$employeeId} not found.");

        return HrEmployeeBenefit::where('employee_id', $employeeId)
            ->with('benefitType')
            ->orderByDesc('effective_from')
            ->get();
    }

    public function assignBenefit(Request $request, string $employeeId)
    {
        $emp = HrEmployee::where('tenant_id', $request->user()->tenant_id)->find($employeeId);
        if (!$emp) throw new NotFoundException("Employee {$employeeId} not found.");

        $request->validate([
            'benefitTypeId' => 'required|uuid',
            'amount'        => 'required|numeric|min:0',
            'effectiveFrom' => 'required|date',
            'effectiveTo'   => 'nullable|date|after:effectiveFrom',
            'notes'         => 'nullable|string',
        ]);

        return response()->json(
            HrEmployeeBenefit::create([
                'id'              => (string) Str::uuid(),
                'tenant_id'       => $request->user()->tenant_id,
                'employee_id'     => $employeeId,
                'benefit_type_id' => $request->benefitTypeId,
                'amount'          => $request->amount,
                'effective_from'  => $request->effectiveFrom,
                'effective_to'    => $request->effectiveTo,
                'notes'           => $request->notes,
            ])->load('benefitType'),
            201
        );
    }

    public function updateBenefit(Request $request, string $id)
    {
        $benefit = HrEmployeeBenefit::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$benefit) throw new NotFoundException("Benefit assignment {$id} not found.");

        $request->validate([
            'amount'      => 'sometimes|numeric|min:0',
            'effectiveTo' => 'nullable|date',
            'notes'       => 'nullable|string',
        ]);

        $benefit->update(array_filter([
            'amount'       => $request->amount,
            'effective_to' => $request->effectiveTo ?? $benefit->effective_to,
            'notes'        => $request->notes,
        ], fn($v) => $v !== null));

        return $benefit;
    }

    public function removeBenefit(Request $request, string $id)
    {
        $benefit = HrEmployeeBenefit::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$benefit) throw new NotFoundException("Benefit assignment {$id} not found.");
        $benefit->delete();
        return response()->json(null, 204);
    }

    // ── Tax Settings ──────────────────────────────────────────────────────────

    public function getTaxSettings(Request $request)
    {
        $setting = HrTaxSetting::where('tenant_id', $request->user()->tenant_id)->first();
        return $setting ?? ['isEnabled' => false, 'taxRatePct' => 0, 'taxFreeAmount' => 0, 'appliesTo' => 'gross'];
    }

    public function upsertTaxSettings(Request $request)
    {
        $request->validate([
            'isEnabled'    => 'required|boolean',
            'taxRatePct'   => 'required|numeric|min:0|max:100',
            'taxFreeAmount'=> 'required|numeric|min:0',
            'appliesTo'    => 'required|in:basic,gross',
            'notes'        => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        $setting = HrTaxSetting::updateOrCreate(
            ['tenant_id' => $tenantId],
            [
                'id'             => (string) Str::uuid(),
                'is_enabled'     => $request->boolean('isEnabled'),
                'tax_rate_pct'   => $request->taxRatePct,
                'tax_free_amount'=> $request->taxFreeAmount,
                'applies_to'     => $request->appliesTo,
                'notes'          => $request->notes,
            ]
        );

        return $setting;
    }

    // ── Payslip Adjustments ───────────────────────────────────────────────────

    public function updatePayslipBonus(Request $request, string $payslipId)
    {
        $payslip = \App\Models\HrPayslip::where('tenant_id', $request->user()->tenant_id)->find($payslipId);
        if (!$payslip) throw new NotFoundException("Payslip {$payslipId} not found.");

        $request->validate([
            'performanceBonus' => 'nullable|numeric|min:0',
            'otherDeductions'  => 'nullable|numeric|min:0',
            'notes'            => 'nullable|string',
        ]);

        $bonus      = $request->performanceBonus ?? $payslip->performance_bonus;
        $deductions = $request->otherDeductions   ?? $payslip->other_deductions;

        // Recalculate net
        $net = $payslip->gross_salary
            + $payslip->overtime_pay
            + $bonus
            + $payslip->expense_reimbursement
            + $payslip->benefit_adjustments
            - $payslip->absent_deduction
            - $payslip->unpaid_leave_deduction
            - $payslip->late_deduction
            - $deductions
            - $payslip->tax_amount;

        $payslip->update([
            'performance_bonus' => $bonus,
            'other_deductions'  => $deductions,
            'net_salary'        => max(0, $net),
        ]);

        return $payslip->load('employee:id,name,employee_code,department,job_title');
    }
}
