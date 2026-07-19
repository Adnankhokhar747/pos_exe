<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrEmployee;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HrEmployeesController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        return HrEmployee::where('tenant_id', $tenantId)
            ->with(['shift:id,name', 'user:id,username,full_name'])
            ->when($request->boolean('activeOnly', false), fn($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get()
            ->map(fn($e) => $this->format($e));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:100',
            'employeeCode'       => 'nullable|string|max:20',
            'email'              => 'nullable|email|max:100',
            'phone'              => 'nullable|string|max:20',
            'department'         => 'nullable|string|max:100',
            'jobTitle'           => 'nullable|string|max:100',
            'joinDate'           => 'nullable|date',
            'shiftId'            => 'nullable|uuid',
            'userId'             => 'nullable|uuid',
            'salaryType'         => 'required|in:monthly,daily,hourly',
            'basicSalary'        => 'required|numeric|min:0',
            'housingAllowance'   => 'nullable|numeric|min:0',
            'transportAllowance' => 'nullable|numeric|min:0',
            'otherAllowances'    => 'nullable|numeric|min:0',
            'annualLeaveDays'    => 'nullable|integer|min:0',
            'overtimeRate'       => 'nullable|numeric|min:1',
            'notes'              => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Validate linked user belongs to same tenant
        if (!empty($validated['userId'])) {
            $exists = User::where('id', $validated['userId'])
                ->where('tenant_id', $tenantId)
                ->exists();
            if (!$exists) {
                return response()->json(['error' => 'invalid_user', 'message' => 'User not found in this tenant.'], 422);
            }
        }

        $emp = HrEmployee::create([
            'id'                  => (string) Str::uuid(),
            'tenant_id'           => $tenantId,
            'user_id'             => $validated['userId'] ?? null,
            'employee_code'       => $validated['employeeCode'] ?? null,
            'name'                => $validated['name'],
            'email'               => $validated['email'] ?? null,
            'phone'               => $validated['phone'] ?? null,
            'department'          => $validated['department'] ?? null,
            'job_title'           => $validated['jobTitle'] ?? null,
            'join_date'           => $validated['joinDate'] ?? null,
            'shift_id'            => $validated['shiftId'] ?? null,
            'salary_type'         => $validated['salaryType'],
            'basic_salary'        => $validated['basicSalary'],
            'housing_allowance'   => $validated['housingAllowance'] ?? 0,
            'transport_allowance' => $validated['transportAllowance'] ?? 0,
            'other_allowances'    => $validated['otherAllowances'] ?? 0,
            'annual_leave_days'   => $validated['annualLeaveDays'] ?? 21,
            'overtime_rate'       => $validated['overtimeRate'] ?? 1.50,
            'notes'               => $validated['notes'] ?? null,
        ]);

        return response()->json($this->format($emp->load(['shift:id,name', 'user:id,username,full_name'])), 201);
    }

    public function show(Request $request, string $id)
    {
        $emp = HrEmployee::where('tenant_id', $request->user()->tenant_id)
            ->with(['shift:id,name', 'user:id,username,full_name'])
            ->findOrFail($id);
        return response()->json($this->format($emp));
    }

    public function update(Request $request, string $id)
    {
        $emp = HrEmployee::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'name'               => 'sometimes|string|max:100',
            'employeeCode'       => 'nullable|string|max:20',
            'email'              => 'nullable|email|max:100',
            'phone'              => 'nullable|string|max:20',
            'department'         => 'nullable|string|max:100',
            'jobTitle'           => 'nullable|string|max:100',
            'joinDate'           => 'nullable|date',
            'shiftId'            => 'nullable|uuid',
            'userId'             => 'nullable|uuid',
            'salaryType'         => 'sometimes|in:monthly,daily,hourly',
            'basicSalary'        => 'sometimes|numeric|min:0',
            'housingAllowance'   => 'nullable|numeric|min:0',
            'transportAllowance' => 'nullable|numeric|min:0',
            'otherAllowances'    => 'nullable|numeric|min:0',
            'annualLeaveDays'    => 'nullable|integer|min:0',
            'overtimeRate'       => 'nullable|numeric|min:1',
            'isActive'           => 'sometimes|boolean',
            'notes'              => 'nullable|string',
        ]);

        $data = array_filter([
            'name'                => $validated['name'] ?? null,
            'employee_code'       => $request->has('employeeCode') ? $request->employeeCode : null,
            'email'               => $request->has('email')        ? $request->email : null,
            'phone'               => $request->has('phone')        ? $request->phone : null,
            'department'          => $request->has('department')   ? $request->department : null,
            'job_title'           => $request->has('jobTitle')     ? $request->jobTitle : null,
            'join_date'           => $request->has('joinDate')     ? $request->joinDate : null,
            'shift_id'            => $request->has('shiftId')      ? $request->shiftId : null,
            'user_id'             => $request->has('userId')       ? $request->userId : null,
            'salary_type'         => $validated['salaryType'] ?? null,
            'basic_salary'        => $validated['basicSalary'] ?? null,
            'housing_allowance'   => $validated['housingAllowance'] ?? null,
            'transport_allowance' => $validated['transportAllowance'] ?? null,
            'other_allowances'    => $validated['otherAllowances'] ?? null,
            'annual_leave_days'   => $validated['annualLeaveDays'] ?? null,
            'overtime_rate'       => $validated['overtimeRate'] ?? null,
            'is_active'           => isset($validated['isActive']) ? (bool)$validated['isActive'] : null,
            'notes'               => $request->has('notes') ? $request->notes : null,
        ], fn($v) => $v !== null);

        $emp->update($data);

        return response()->json($this->format($emp->fresh()->load(['shift:id,name', 'user:id,username,full_name'])));
    }

    public function linkableUsers(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $linked   = HrEmployee::where('tenant_id', $tenantId)->whereNotNull('user_id')->pluck('user_id');

        return User::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereNotIn('id', $linked)
            ->orderBy('full_name')
            ->get(['id', 'username', 'full_name'])
            ->map(fn($u) => ['id' => $u->id, 'username' => $u->username, 'fullName' => $u->full_name]);
    }

    private function format(HrEmployee $e): array
    {
        return [
            'id'                  => $e->id,
            'tenantId'            => $e->tenant_id,
            'userId'              => $e->user_id,
            'userName'            => $e->user?->full_name,
            'employeeCode'        => $e->employee_code,
            'name'                => $e->name,
            'email'               => $e->email,
            'phone'               => $e->phone,
            'department'          => $e->department,
            'jobTitle'            => $e->job_title,
            'joinDate'            => $e->join_date?->toDateString(),
            'shiftId'             => $e->shift_id,
            'shiftName'           => $e->shift?->name,
            'salaryType'          => $e->salary_type,
            'basicSalary'         => (float) $e->basic_salary,
            'housingAllowance'    => (float) $e->housing_allowance,
            'transportAllowance'  => (float) $e->transport_allowance,
            'otherAllowances'     => (float) $e->other_allowances,
            'grossSalary'         => $e->grossSalary(),
            'annualLeaveDays'     => $e->annual_leave_days,
            'overtimeRate'        => (float) $e->overtime_rate,
            'isActive'            => $e->is_active,
            'notes'               => $e->notes,
            'createdAt'           => $e->created_at?->toISOString(),
        ];
    }
}
