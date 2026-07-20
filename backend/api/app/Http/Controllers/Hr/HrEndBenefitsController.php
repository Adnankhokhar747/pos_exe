<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\HrEndOfServiceRecord;
use App\Models\HrEmployee;
use App\Exceptions\NotFoundException;

class HrEndBenefitsController extends Controller
{
    public function index(Request $request)
    {
        return HrEndOfServiceRecord::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('end_date')
            ->with('employee:id,name,employee_code')
            ->get();
    }

    public function calculate(Request $request)
    {
        $request->validate([
            'employeeId' => 'required|uuid',
            'endDate'    => 'required|date',
            'reason'     => 'required|in:resignation,termination,retirement,death,other',
            'basicSalary'=> 'nullable|numeric|min:0',
        ]);

        $tenantId = $request->user()->tenant_id;
        $emp = HrEmployee::where('tenant_id', $tenantId)->find($request->employeeId);
        if (!$emp) throw new NotFoundException('Employee not found.');

        $joinDate    = new \DateTime($emp->join_date ?? now()->toDateString());
        $endDate     = new \DateTime($request->endDate);
        $basic       = $request->basicSalary ?? $emp->basic_salary;

        $totalYears  = $this->yearsBetween($joinDate, $endDate);
        $reason      = $request->reason;

        [$qualifying, $amount, $notes] = $this->computeEosb($totalYears, $basic, $reason);

        return response()->json([
            'employeeId'       => $emp->id,
            'employeeName'     => $emp->name,
            'joinDate'         => $emp->join_date,
            'endDate'          => $request->endDate,
            'reason'           => $reason,
            'basicSalary'      => (float) $basic,
            'yearsOfService'   => round($totalYears, 2),
            'qualifyingYears'  => round($qualifying, 2),
            'eosbAmount'       => round($amount, 2),
            'calculationNotes' => $notes,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'employeeId'         => 'required|uuid',
            'endDate'            => 'required|date',
            'reason'             => 'required|in:resignation,termination,retirement,death,other',
            'basicSalary'        => 'nullable|numeric|min:0',
            'calculationNotes'   => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;
        $emp = HrEmployee::where('tenant_id', $tenantId)->find($request->employeeId);
        if (!$emp) throw new NotFoundException('Employee not found.');

        $joinDate  = new \DateTime($emp->join_date ?? now()->toDateString());
        $endDate   = new \DateTime($request->endDate);
        $basic     = $request->basicSalary ?? $emp->basic_salary;
        $totalYears = $this->yearsBetween($joinDate, $endDate);
        [$qualifying, $amount, $notes] = $this->computeEosb($totalYears, $basic, $request->reason);

        $record = HrEndOfServiceRecord::create([
            'id'                => (string) Str::uuid(),
            'tenant_id'         => $tenantId,
            'employee_id'       => $emp->id,
            'employee_name'     => $emp->name,
            'join_date'         => $emp->join_date,
            'end_date'          => $request->endDate,
            'reason'            => $request->reason,
            'basic_salary'      => $basic,
            'years_of_service'  => round($totalYears, 4),
            'qualifying_years'  => round($qualifying, 4),
            'eosb_amount'       => round($amount, 2),
            'calculation_notes' => $request->calculationNotes ?? $notes,
            'approved_by'       => $request->user()->id,
        ]);

        // Deactivate employee
        $emp->update(['is_active' => false]);

        return response()->json($record->load('employee:id,name,employee_code'), 201);
    }

    // ── Qatar Labour Law EOSB calculation ────────────────────────────────────
    // Resignation: < 1yr = 0; 1-3yr = 1/3; 3-5yr = 2/3; >5yr = full
    // Termination/others: from day 1, full entitlement
    // Rate: 3 weeks (21 days) basic per year for first 5 years, then 4 weeks (28 days) per year

    private function computeEosb(float $years, float $basic, string $reason): array
    {
        if ($years < 1) {
            if ($reason === 'resignation') {
                return [0, 0, 'Less than 1 year of service — no EOSB for resignation.'];
            }
        }

        $dailyBasic = $basic / 30;

        // Calculate entitlement split: first 5 years @ 21 days/yr, remainder @ 28 days/yr
        if ($years <= 5) {
            $amount = $years * 21 * $dailyBasic;
        } else {
            $amount = (5 * 21 * $dailyBasic) + (($years - 5) * 28 * $dailyBasic);
        }

        // Resignation multiplier
        $qualifying = $years;
        if ($reason === 'resignation') {
            if ($years < 3) {
                $amount     *= 1 / 3;
                $qualifying  = $years * (1 / 3);
                $notes = sprintf('Resignation (1-3 yrs) → 1/3 of %.2f full years = %.2f qualifying years.', $years, $qualifying);
            } elseif ($years < 5) {
                $amount     *= 2 / 3;
                $qualifying  = $years * (2 / 3);
                $notes = sprintf('Resignation (3-5 yrs) → 2/3 of %.2f full years = %.2f qualifying years.', $years, $qualifying);
            } else {
                $notes = sprintf('Resignation (>5 yrs) → Full entitlement. %.2f years of service.', $years);
            }
        } else {
            $notes = sprintf('%.2f years of service. Full entitlement (termination/retirement/other).', $years);
        }

        return [$qualifying, $amount, $notes ?? ''];
    }

    private function yearsBetween(\DateTime $from, \DateTime $to): float
    {
        $diff = $from->diff($to);
        return $diff->y + ($diff->m / 12) + ($diff->d / 365);
    }
}
