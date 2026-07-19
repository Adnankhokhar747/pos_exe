<?php

namespace App\Services\Hr;

use App\Models\HrEmployee;
use App\Models\HrAttendance;
use App\Models\HrLeave;
use App\Models\HrLeaveType;
use App\Models\HrPayrollRun;
use App\Models\HrPayslip;
use Carbon\Carbon;
use Illuminate\Support\Str;

class HrPayrollService
{
    /**
     * Count working days in a month (Sun–Thu = Qatar standard week).
     * Friday and Saturday are treated as weekend.
     */
    public function countWorkingDays(int $year, int $month): int
    {
        $days = 0;
        $date = Carbon::create($year, $month, 1);
        $end  = $date->copy()->endOfMonth();
        while ($date <= $end) {
            if (!in_array($date->dayOfWeek, [Carbon::FRIDAY, Carbon::SATURDAY])) {
                $days++;
            }
            $date->addDay();
        }
        return $days;
    }

    /**
     * Generate (or regenerate) payslips for a payroll run.
     * Existing draft payslips for this run are deleted and recreated.
     */
    public function generatePayslips(HrPayrollRun $run): void
    {
        if ($run->status !== 'draft') {
            throw new \RuntimeException('Cannot regenerate payslips for an approved or paid payroll run.');
        }

        $tenantId    = $run->tenant_id;
        $month       = $run->month;
        $year        = $run->year;
        $workingDays = $run->working_days;

        // Clear existing payslips for this run
        HrPayslip::where('payroll_run_id', $run->id)->delete();

        $employees = HrEmployee::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get();

        $totalGross      = 0.0;
        $totalDeductions = 0.0;
        $totalNet        = 0.0;

        $startDate = Carbon::create($year, $month, 1)->startOfMonth()->toDateString();
        $endDate   = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();

        foreach ($employees as $emp) {
            $payslip = $this->buildPayslip($emp, $run, $workingDays, $startDate, $endDate);
            HrPayslip::create($payslip);

            $totalGross      += $payslip['gross_salary'];
            $totalDeductions += $payslip['absent_deduction'] + $payslip['unpaid_leave_deduction'] + $payslip['late_deduction'] + $payslip['other_deductions'];
            $totalNet        += $payslip['net_salary'];
        }

        $run->update([
            'total_gross'      => round($totalGross, 2),
            'total_deductions' => round($totalDeductions, 2),
            'total_net'        => round($totalNet, 2),
        ]);
    }

    private function buildPayslip(HrEmployee $emp, HrPayrollRun $run, int $workingDays, string $startDate, string $endDate): array
    {
        // Attendance for the month
        $attendance = HrAttendance::where('employee_id', $emp->id)
            ->whereBetween('work_date', [$startDate, $endDate])
            ->get();

        $presentDays    = $attendance->whereIn('status', ['present', 'late'])->count();
        $halfDayCount   = $attendance->where('status', 'half_day')->count();
        $lateCount      = $attendance->where('status', 'late')->count();
        $overtimeMinutes = $attendance->sum('overtime_minutes');
        $overtimeHours  = round($overtimeMinutes / 60, 2);

        // Count half-days as 0.5 days
        $presentDays += $halfDayCount * 0.5;

        // Approved leaves in this period
        $leaves = HrLeave::where('employee_id', $emp->id)
            ->where('status', 'approved')
            ->where('from_date', '<=', $endDate)
            ->where('to_date', '>=', $startDate)
            ->with('leaveType')
            ->get();

        $paidLeaveDays   = 0;
        $unpaidLeaveDays = 0;
        foreach ($leaves as $leave) {
            // Clip leave days to the payroll month window
            $from = max(Carbon::parse($leave->from_date), Carbon::parse($startDate));
            $to   = min(Carbon::parse($leave->to_date),   Carbon::parse($endDate));
            $days = max(0, $from->diffInDays($to) + 1);

            if ($leave->leaveType?->is_paid) {
                $paidLeaveDays += $days;
            } else {
                $unpaidLeaveDays += $days;
            }
        }

        // Present days includes paid leave days (they're still "paid working days")
        $effectivePresentDays = $presentDays + $paidLeaveDays;
        $absentDays = max(0, $workingDays - $effectivePresentDays - $unpaidLeaveDays);

        $grossSalary      = $emp->grossSalary();
        $dailyRate        = $workingDays > 0 ? $grossSalary / $workingDays : 0;
        $hourlyRate       = $dailyRate / 8;

        $absentDeduction     = round($dailyRate * $absentDays, 2);
        $unpaidLeaveDeduction = round($dailyRate * $unpaidLeaveDays, 2);
        // Late deduction: 0.5 hour per late instance
        $lateDeduction       = round($hourlyRate * 0.5 * $lateCount, 2);
        $overtimePay         = round($hourlyRate * (float)$emp->overtime_rate * $overtimeHours, 2);

        $netSalary = round(
            $grossSalary
            + $overtimePay
            - $absentDeduction
            - $unpaidLeaveDeduction
            - $lateDeduction,
            2
        );

        return [
            'id'                     => (string) Str::uuid(),
            'payroll_run_id'         => $run->id,
            'tenant_id'              => $run->tenant_id,
            'employee_id'            => $emp->id,
            'month'                  => $run->month,
            'year'                   => $run->year,
            'working_days'           => $workingDays,
            'present_days'           => (int) floor($presentDays),
            'absent_days'            => (int) ceil($absentDays),
            'paid_leave_days'        => $paidLeaveDays,
            'unpaid_leave_days'      => $unpaidLeaveDays,
            'late_count'             => $lateCount,
            'overtime_hours'         => $overtimeHours,
            'basic_salary'           => $emp->basic_salary,
            'housing_allowance'      => $emp->housing_allowance,
            'transport_allowance'    => $emp->transport_allowance,
            'other_allowances'       => $emp->other_allowances,
            'gross_salary'           => round($grossSalary, 2),
            'absent_deduction'       => $absentDeduction,
            'unpaid_leave_deduction' => $unpaidLeaveDeduction,
            'late_deduction'         => $lateDeduction,
            'other_deductions'       => 0.0,
            'overtime_pay'           => $overtimePay,
            'net_salary'             => max(0, $netSalary),
            'status'                 => 'draft',
        ];
    }
}
