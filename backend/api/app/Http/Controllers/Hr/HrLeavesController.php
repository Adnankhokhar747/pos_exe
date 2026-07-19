<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrEmployee;
use App\Models\HrLeave;
use App\Models\HrLeaveType;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HrLeavesController extends Controller
{
    // ── Leave Types ──────────────────────────────────────────────────────────

    public function listTypes(Request $request)
    {
        return HrLeaveType::where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn($t) => $this->formatType($t));
    }

    public function storeType(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:100',
            'isPaid'      => 'required|boolean',
            'daysPerYear' => 'nullable|integer|min:1',
        ]);

        $type = HrLeaveType::create([
            'id'            => (string) Str::uuid(),
            'tenant_id'     => $request->user()->tenant_id,
            'name'          => $request->name,
            'is_paid'       => $request->isPaid,
            'days_per_year' => $request->daysPerYear,
        ]);

        return response()->json($this->formatType($type), 201);
    }

    public function updateType(Request $request, string $id)
    {
        $type = HrLeaveType::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $request->validate([
            'name'        => 'sometimes|string|max:100',
            'isPaid'      => 'sometimes|boolean',
            'daysPerYear' => 'nullable|integer|min:1',
            'isActive'    => 'sometimes|boolean',
        ]);

        $type->update(array_filter([
            'name'          => $request->name,
            'is_paid'       => $request->has('isPaid') ? (bool)$request->isPaid : null,
            'days_per_year' => $request->daysPerYear,
            'is_active'     => $request->has('isActive') ? (bool)$request->isActive : null,
        ], fn($v) => $v !== null));

        return response()->json($this->formatType($type->fresh()));
    }

    // ── Leave Requests ───────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        return HrLeave::where('tenant_id', $tenantId)
            ->with(['employee:id,name,employee_code', 'leaveType:id,name,is_paid'])
            ->when($request->employeeId, fn($q, $v) => $q->where('employee_id', $v))
            ->when($request->status,     fn($q, $v) => $q->where('status', $v))
            ->when($request->from,       fn($q, $v) => $q->where('from_date', '>=', $v))
            ->when($request->to,         fn($q, $v) => $q->where('to_date', '<=', $v))
            ->orderByDesc('created_at')
            ->limit(300)
            ->get()
            ->map(fn($l) => $this->format($l));
    }

    public function store(Request $request)
    {
        $request->validate([
            'employeeId'  => 'required|uuid',
            'leaveTypeId' => 'required|uuid',
            'fromDate'    => 'required|date',
            'toDate'      => 'required|date|after_or_equal:fromDate',
            'reason'      => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;
        $emp      = HrEmployee::where('tenant_id', $tenantId)->findOrFail($request->employeeId);
        HrLeaveType::where('tenant_id', $tenantId)->findOrFail($request->leaveTypeId);

        $from = Carbon::parse($request->fromDate);
        $to   = Carbon::parse($request->toDate);
        $days = (int) $from->diffInDays($to) + 1;

        // Check for overlapping approved/pending leaves
        $overlap = HrLeave::where('employee_id', $emp->id)
            ->whereIn('status', ['pending', 'approved'])
            ->where('from_date', '<=', $to->toDateString())
            ->where('to_date',   '>=', $from->toDateString())
            ->exists();

        if ($overlap) {
            return response()->json(['error' => 'overlap', 'message' => 'An existing leave overlaps with the requested dates.'], 422);
        }

        $leave = HrLeave::create([
            'id'            => (string) Str::uuid(),
            'tenant_id'     => $tenantId,
            'employee_id'   => $emp->id,
            'leave_type_id' => $request->leaveTypeId,
            'from_date'     => $from->toDateString(),
            'to_date'       => $to->toDateString(),
            'days'          => $days,
            'reason'        => $request->reason,
            'status'        => 'pending',
            'created_by'    => $request->user()->id,
        ]);

        return response()->json($this->format($leave->load(['employee:id,name,employee_code', 'leaveType:id,name,is_paid'])), 201);
    }

    public function approve(Request $request, string $id)
    {
        $leave = HrLeave::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        if ($leave->status !== 'pending') {
            return response()->json(['error' => 'invalid_status', 'message' => 'Only pending leaves can be approved.'], 422);
        }

        $leave->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json($this->format($leave->fresh()->load(['employee:id,name,employee_code', 'leaveType:id,name,is_paid'])));
    }

    public function reject(Request $request, string $id)
    {
        $request->validate(['reason' => 'nullable|string|max:255']);
        $leave = HrLeave::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        if ($leave->status !== 'pending') {
            return response()->json(['error' => 'invalid_status', 'message' => 'Only pending leaves can be rejected.'], 422);
        }

        $leave->update([
            'status'           => 'rejected',
            'approved_by'      => $request->user()->id,
            'approved_at'      => now(),
            'rejection_reason' => $request->reason,
        ]);

        return response()->json($this->format($leave->fresh()->load(['employee:id,name,employee_code', 'leaveType:id,name,is_paid'])));
    }

    public function balance(Request $request, string $employeeId)
    {
        $tenantId = $request->user()->tenant_id;
        $emp      = HrEmployee::where('tenant_id', $tenantId)->findOrFail($employeeId);
        $year     = $request->year ?? now()->year;

        $types = HrLeaveType::where('tenant_id', $tenantId)->where('is_active', true)->get();

        $balance = $types->map(function ($type) use ($emp, $year) {
            $used = HrLeave::where('employee_id', $emp->id)
                ->where('leave_type_id', $type->id)
                ->where('status', 'approved')
                ->whereYear('from_date', $year)
                ->sum('days');

            $entitled = $type->days_per_year ?? ($type->is_paid ? $emp->annual_leave_days : null);

            return [
                'leaveTypeId'   => $type->id,
                'leaveTypeName' => $type->name,
                'isPaid'        => $type->is_paid,
                'entitled'      => $entitled,
                'used'          => (int) $used,
                'remaining'     => $entitled !== null ? max(0, $entitled - $used) : null,
            ];
        });

        return response()->json(['employeeId' => $emp->id, 'year' => $year, 'balance' => $balance]);
    }

    private function format(HrLeave $l): array
    {
        return [
            'id'              => $l->id,
            'employeeId'      => $l->employee_id,
            'employeeName'    => $l->employee?->name,
            'employeeCode'    => $l->employee?->employee_code,
            'leaveTypeId'     => $l->leave_type_id,
            'leaveTypeName'   => $l->leaveType?->name,
            'isPaid'          => $l->leaveType?->is_paid,
            'fromDate'        => $l->from_date?->toDateString(),
            'toDate'          => $l->to_date?->toDateString(),
            'days'            => $l->days,
            'reason'          => $l->reason,
            'status'          => $l->status,
            'rejectionReason' => $l->rejection_reason,
            'approvedAt'      => $l->approved_at?->toISOString(),
            'createdAt'       => $l->created_at?->toISOString(),
        ];
    }

    private function formatType(HrLeaveType $t): array
    {
        return [
            'id'          => $t->id,
            'name'        => $t->name,
            'isPaid'      => $t->is_paid,
            'daysPerYear' => $t->days_per_year,
            'isActive'    => $t->is_active,
        ];
    }
}
