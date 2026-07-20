<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrAttendance;
use App\Models\HrEmployee;
use App\Models\HrShift;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HrAttendanceController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        return HrAttendance::where('tenant_id', $tenantId)
            ->with('employee:id,name,employee_code')
            ->when($request->employeeId, fn($q, $v) => $q->where('employee_id', $v))
            ->when($request->from,       fn($q, $v) => $q->where('work_date', '>=', $v))
            ->when($request->to,         fn($q, $v) => $q->where('work_date', '<=', $v))
            ->when($request->status,     fn($q, $v) => $q->where('status', $v))
            ->when(!$request->from && !$request->to, fn($q) => $q->where('work_date', '>=', now()->subDays(30)->toDateString()))
            ->orderByDesc('work_date')
            ->orderBy('employee_id')
            ->limit(500)
            ->get()
            ->map(fn($a) => $this->format($a));
    }

    /**
     * My today status — any logged-in user with a linked employee record.
     */
    public function myToday(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $today    = now()->toDateString();

        $emp = HrEmployee::where('tenant_id', $tenantId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$emp) {
            return response()->json(['hasEmployee' => false]);
        }

        $record = HrAttendance::where('employee_id', $emp->id)
            ->where('work_date', $today)
            ->first();

        return response()->json([
            'hasEmployee'  => true,
            'employeeId'   => $emp->id,
            'employeeName' => $emp->name,
            'today'        => $today,
            'attendance'   => $record ? $this->format($record) : null,
        ]);
    }

    /**
     * Clock in — creates today's attendance record.
     */
    public function clockIn(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $today    = now()->toDateString();
        $now      = now();

        // Resolve employee: from request (admin) or from logged-in user
        $employeeId = $request->employeeId;
        if ($employeeId) {
            $emp = HrEmployee::where('tenant_id', $tenantId)->findOrFail($employeeId);
        } else {
            $emp = HrEmployee::where('tenant_id', $tenantId)
                ->where('user_id', $request->user()->id)
                ->first();
            if (!$emp) {
                return response()->json(['error' => 'no_employee', 'message' => 'No employee profile linked to your account.'], 422);
            }
        }

        // Prevent duplicate clock-in
        $existing = HrAttendance::where('employee_id', $emp->id)->where('work_date', $today)->first();
        if ($existing) {
            return response()->json(['error' => 'already_clocked_in', 'message' => 'Already clocked in today.'], 422);
        }

        // Determine status (late check against shift)
        $status = 'present';
        if ($emp->shift_id) {
            $shift       = HrShift::find($emp->shift_id);
            $shiftStart  = Carbon::parse($today . ' ' . $shift->start_time);
            $graceCutoff = $shiftStart->copy()->addMinutes($shift->grace_minutes ?? 15);
            if ($now->gt($graceCutoff)) $status = 'late';
        }

        $record = HrAttendance::create([
            'id'          => (string) Str::uuid(),
            'tenant_id'   => $tenantId,
            'employee_id' => $emp->id,
            'work_date'   => $today,
            'clock_in'    => $now,
            'status'      => $status,
            'created_by'  => $request->user()->id,
        ]);

        return response()->json($this->format($record->load('employee:id,name,employee_code')), 201);
    }

    /**
     * Clock out — updates today's attendance record with clock_out and work_minutes.
     */
    public function clockOut(Request $request)
    {
        $tenantId   = $request->user()->tenant_id;
        $today      = now()->toDateString();
        $now        = now();

        $employeeId = $request->employeeId;
        if ($employeeId) {
            $emp = HrEmployee::where('tenant_id', $tenantId)->findOrFail($employeeId);
        } else {
            $emp = HrEmployee::where('tenant_id', $tenantId)
                ->where('user_id', $request->user()->id)
                ->first();
            if (!$emp) {
                return response()->json(['error' => 'no_employee', 'message' => 'No employee profile linked to your account.'], 422);
            }
        }

        $record = HrAttendance::where('employee_id', $emp->id)->where('work_date', $today)->first();
        if (!$record) {
            return response()->json(['error' => 'not_clocked_in', 'message' => 'No clock-in found for today.'], 422);
        }
        if ($record->clock_out) {
            return response()->json(['error' => 'already_clocked_out', 'message' => 'Already clocked out today.'], 422);
        }

        $workMinutes    = (int) $record->clock_in->diffInMinutes($now);
        $standardMinutes = 8 * 60; // 8-hour standard day
        $overtimeMinutes = max(0, $workMinutes - $standardMinutes);

        $record->update([
            'clock_out'        => $now,
            'work_minutes'     => $workMinutes,
            'overtime_minutes' => $overtimeMinutes,
        ]);

        return response()->json($this->format($record->fresh()->load('employee:id,name,employee_code')));
    }

    /**
     * Manual attendance record (admin correction or bulk mark absent).
     */
    public function upsert(Request $request)
    {
        $request->validate([
            'employeeId' => 'required|uuid',
            'workDate'   => 'required|date',
            'status'     => 'required|in:present,absent,late,half_day,on_leave',
            'clockIn'    => 'nullable|date_format:Y-m-d H:i',
            'clockOut'   => 'nullable|date_format:Y-m-d H:i',
            'notes'      => 'nullable|string|max:255',
        ]);

        $tenantId = $request->user()->tenant_id;
        $emp = HrEmployee::where('tenant_id', $tenantId)->findOrFail($request->employeeId);

        $workMinutes = null;
        $overMinutes = 0;
        if ($request->clockIn && $request->clockOut) {
            $ci = Carbon::parse($request->clockIn);
            $co = Carbon::parse($request->clockOut);
            $workMinutes = (int) $ci->diffInMinutes($co);
            $overMinutes = max(0, $workMinutes - 480);
        }

        $record = HrAttendance::updateOrCreate(
            ['employee_id' => $emp->id, 'work_date' => $request->workDate],
            [
                'id'               => (string) Str::uuid(),
                'tenant_id'        => $tenantId,
                'clock_in'         => $request->clockIn,
                'clock_out'        => $request->clockOut,
                'status'           => $request->status,
                'work_minutes'     => $workMinutes,
                'overtime_minutes' => $overMinutes,
                'notes'            => $request->notes,
                'created_by'       => $request->user()->id,
            ]
        );

        return response()->json($this->format($record->load('employee:id,name,employee_code')));
    }

    /**
     * Bulk upsert attendance records for multiple employees on a single date.
     */
    public function bulkUpsert(Request $request)
    {
        $request->validate([
            'records'            => 'required|array|min:1',
            'records.*.employeeId' => 'required|uuid',
            'records.*.workDate'   => 'required|date',
            'records.*.status'     => 'required|in:present,absent,late,half_day,on_leave',
            'records.*.clockIn'    => 'nullable|date_format:Y-m-d H:i',
            'records.*.clockOut'   => 'nullable|date_format:Y-m-d H:i',
            'records.*.notes'      => 'nullable|string|max:255',
        ]);

        $tenantId = $request->user()->tenant_id;
        $results  = [];

        foreach ($request->records as $row) {
            $emp = HrEmployee::where('tenant_id', $tenantId)->find($row['employeeId']);
            if (!$emp) continue;

            $workMinutes = null;
            $overMinutes = 0;
            if (!empty($row['clockIn']) && !empty($row['clockOut'])) {
                $ci = Carbon::parse($row['clockIn']);
                $co = Carbon::parse($row['clockOut']);
                $workMinutes = (int) $ci->diffInMinutes($co);
                $overMinutes = max(0, $workMinutes - 480);
            }

            $record = HrAttendance::updateOrCreate(
                ['employee_id' => $emp->id, 'work_date' => $row['workDate']],
                [
                    'id'               => (string) Str::uuid(),
                    'tenant_id'        => $tenantId,
                    'clock_in'         => $row['clockIn'] ?? null,
                    'clock_out'        => $row['clockOut'] ?? null,
                    'status'           => $row['status'],
                    'work_minutes'     => $workMinutes,
                    'overtime_minutes' => $overMinutes,
                    'notes'            => $row['notes'] ?? null,
                    'created_by'       => $request->user()->id,
                ]
            );

            $results[] = $this->format($record->load('employee:id,name,employee_code'));
        }

        return response()->json($results);
    }

    private function format(HrAttendance $a): array
    {
        return [
            'id'              => $a->id,
            'employeeId'      => $a->employee_id,
            'employeeName'    => $a->employee?->name,
            'employeeCode'    => $a->employee?->employee_code,
            'workDate'        => $a->work_date?->toDateString(),
            'clockIn'         => $a->clock_in?->toTimeString('minute'),
            'clockOut'        => $a->clock_out?->toTimeString('minute'),
            'status'          => $a->status,
            'workMinutes'     => $a->work_minutes,
            'overtimeMinutes' => $a->overtime_minutes,
            'notes'           => $a->notes,
        ];
    }
}
