<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrAttendance;
use App\Models\HrEmployee;
use Carbon\Carbon;
use Illuminate\Http\Request;

class HrReportsController extends Controller
{
    /**
     * Attendance summary per employee for a date range.
     */
    public function attendanceSummary(Request $request)
    {
        $request->validate([
            'from' => 'required|date',
            'to'   => 'required|date|after_or_equal:from',
        ]);

        $tenantId = $request->user()->tenant_id;

        $employees = HrEmployee::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $records = HrAttendance::where('tenant_id', $tenantId)
            ->whereBetween('work_date', [$request->from, $request->to])
            ->get()
            ->groupBy('employee_id');

        $from  = Carbon::parse($request->from);
        $to    = Carbon::parse($request->to);
        $days  = (int) $from->diffInDays($to) + 1;

        return response()->json($employees->map(function ($emp) use ($records, $days) {
            $att = $records->get($emp->id, collect());
            return [
                'employeeId'     => $emp->id,
                'employeeName'   => $emp->name,
                'employeeCode'   => $emp->employee_code,
                'department'     => $emp->department,
                'totalDays'      => $days,
                'presentDays'    => $att->whereIn('status', ['present', 'late'])->count(),
                'absentDays'     => $att->where('status', 'absent')->count(),
                'lateDays'       => $att->where('status', 'late')->count(),
                'halfDays'       => $att->where('status', 'half_day')->count(),
                'leaveDays'      => $att->where('status', 'on_leave')->count(),
                'overtimeHours'  => round($att->sum('overtime_minutes') / 60, 2),
                'totalWorkHours' => round($att->sum('work_minutes') / 60, 2),
            ];
        }));
    }

    /**
     * Day-by-day attendance grid for a single month (used for the monthly attendance sheet).
     */
    public function monthlyGrid(Request $request)
    {
        $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year'  => 'required|integer|min:2020|max:2100',
        ]);

        $tenantId = $request->user()->tenant_id;
        $month    = (int) $request->month;
        $year     = (int) $request->year;

        $startDate = Carbon::create($year, $month, 1)->startOfMonth()->toDateString();
        $endDate   = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();

        $employees = HrEmployee::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'employee_code', 'department']);

        $records = HrAttendance::where('tenant_id', $tenantId)
            ->whereBetween('work_date', [$startDate, $endDate])
            ->get()
            ->groupBy('employee_id');

        // Build an array of days in the month
        $days = [];
        $date = Carbon::create($year, $month, 1);
        $end  = $date->copy()->endOfMonth();
        while ($date <= $end) {
            $days[] = $date->toDateString();
            $date->addDay();
        }

        $grid = $employees->map(function ($emp) use ($records, $days) {
            $att = $records->get($emp->id, collect())->keyBy(fn($a) => $a->work_date->toDateString());
            return [
                'employeeId'   => $emp->id,
                'employeeName' => $emp->name,
                'employeeCode' => $emp->employee_code,
                'department'   => $emp->department,
                'days'         => collect($days)->map(fn($d) => [
                    'date'   => $d,
                    'status' => $att->get($d)?->status ?? null,
                ]),
            ];
        });

        return response()->json(['days' => $days, 'employees' => $grid]);
    }
}
