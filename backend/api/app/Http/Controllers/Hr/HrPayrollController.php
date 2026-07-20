<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrPayrollRun;
use App\Models\HrPayslip;
use App\Services\Hr\HrPayrollService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HrPayrollController extends Controller
{
    public function __construct(private HrPayrollService $payroll) {}

    public function index(Request $request)
    {
        return HrPayrollRun::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('year')
            ->orderByDesc('month')
            ->get()
            ->map(fn($r) => $this->format($r));
    }

    public function generate(Request $request)
    {
        $request->validate([
            'month'       => 'required|integer|min:1|max:12',
            'year'        => 'required|integer|min:2020|max:2100',
            'workingDays' => 'nullable|integer|min:1|max:31',
            'notes'       => 'nullable|string',
        ]);

        $tenantId    = $request->user()->tenant_id;
        $month       = (int) $request->month;
        $year        = (int) $request->year;

        // Auto-calculate working days (Sun–Thu = Qatar standard) if not provided
        $workingDays = $request->workingDays
            ? (int) $request->workingDays
            : $this->payroll->countWorkingDays($year, $month);

        // Allow regenerating a draft; reject if already approved/paid
        $existing = HrPayrollRun::where('tenant_id', $tenantId)
            ->where('month', $month)->where('year', $year)->first();

        if ($existing && $existing->status !== 'draft') {
            return response()->json(['error' => 'payroll_locked', 'message' => 'This payroll run is already approved or paid and cannot be regenerated.'], 422);
        }

        if ($existing) {
            $run = $existing;
            $run->update(['working_days' => $workingDays, 'notes' => $request->notes]);
        } else {
            $run = HrPayrollRun::create([
                'id'          => (string) Str::uuid(),
                'tenant_id'   => $tenantId,
                'month'       => $month,
                'year'        => $year,
                'working_days'=> $workingDays,
                'status'      => 'draft',
                'notes'       => $request->notes,
                'created_by'  => $request->user()->id,
            ]);
        }

        $this->payroll->generatePayslips($run);

        return response()->json($this->format($run->fresh()), 201);
    }

    public function show(Request $request, string $id)
    {
        $run = HrPayrollRun::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        return response()->json($this->format($run));
    }

    public function payslips(Request $request, string $id)
    {
        $run = HrPayrollRun::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $payslips = HrPayslip::where('payroll_run_id', $run->id)
            ->with('employee:id,name,employee_code,department,job_title')
            ->get()
            ->map(fn($p) => $this->formatPayslip($p));

        return response()->json($payslips);
    }

    public function approve(Request $request, string $id)
    {
        $run = HrPayrollRun::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        if ($run->status !== 'draft') {
            return response()->json(['error' => 'invalid_status', 'message' => 'Only draft payroll runs can be approved.'], 422);
        }

        $run->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json($this->format($run->fresh()));
    }

    public function markPaid(Request $request, string $id)
    {
        $run = HrPayrollRun::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        if ($run->status !== 'approved') {
            return response()->json(['error' => 'invalid_status', 'message' => 'Only approved payroll runs can be marked as paid.'], 422);
        }

        $run->update(['status' => 'paid']);
        HrPayslip::where('payroll_run_id', $run->id)->update(['status' => 'paid']);

        return response()->json($this->format($run->fresh()));
    }

    public function destroy(Request $request, string $id)
    {
        $run = HrPayrollRun::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        if ($run->status !== 'draft') {
            return response()->json(['error' => 'locked', 'message' => 'Only draft payroll runs can be deleted.'], 422);
        }

        HrPayslip::where('payroll_run_id', $run->id)->delete();
        $run->delete();

        return response()->json(null, 204);
    }

    private function format(HrPayrollRun $r): array
    {
        return [
            'id'              => $r->id,
            'month'           => $r->month,
            'year'            => $r->year,
            'workingDays'     => $r->working_days,
            'status'          => $r->status,
            'totalGross'      => (float) $r->total_gross,
            'totalDeductions' => (float) $r->total_deductions,
            'totalNet'        => (float) $r->total_net,
            'notes'           => $r->notes,
            'approvedAt'      => $r->approved_at?->toISOString(),
            'createdAt'       => $r->created_at?->toISOString(),
        ];
    }

    public function formatPayslip(HrPayslip $p): array
    {
        return [
            'id'                    => $p->id,
            'payrollRunId'          => $p->payroll_run_id,
            'employeeId'            => $p->employee_id,
            'employeeName'          => $p->employee?->name,
            'employeeCode'          => $p->employee?->employee_code,
            'department'            => $p->employee?->department,
            'jobTitle'              => $p->employee?->job_title,
            'month'                 => $p->month,
            'year'                  => $p->year,
            'workingDays'           => $p->working_days,
            'presentDays'           => $p->present_days,
            'absentDays'            => $p->absent_days,
            'paidLeaveDays'         => $p->paid_leave_days,
            'unpaidLeaveDays'       => $p->unpaid_leave_days,
            'lateCount'             => $p->late_count,
            'overtimeHours'         => (float) $p->overtime_hours,
            'basicSalary'           => (float) $p->basic_salary,
            'housingAllowance'      => (float) $p->housing_allowance,
            'transportAllowance'    => (float) $p->transport_allowance,
            'otherAllowances'       => (float) $p->other_allowances,
            'grossSalary'           => (float) $p->gross_salary,
            'absentDeduction'       => (float) $p->absent_deduction,
            'unpaidLeaveDeduction'  => (float) $p->unpaid_leave_deduction,
            'lateDeduction'         => (float) $p->late_deduction,
            'otherDeductions'       => (float) $p->other_deductions,
            'overtimePay'           => (float) $p->overtime_pay,
            'performanceBonus'      => (float) ($p->performance_bonus ?? 0),
            'expenseReimbursement'  => (float) ($p->expense_reimbursement ?? 0),
            'benefitAdjustments'    => (float) ($p->benefit_adjustments ?? 0),
            'eosbProvision'         => (float) ($p->eosb_provision ?? 0),
            'taxAmount'             => (float) ($p->tax_amount ?? 0),
            'netSalary'             => (float) $p->net_salary,
            'status'                => $p->status,
        ];
    }
}
