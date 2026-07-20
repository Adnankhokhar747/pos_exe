<?php

namespace App\Http\Controllers\Hospital;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class DoctorsController extends Controller
{
    public function index(Request $request)
    {
        return Doctor::where('tenant_id', $request->user()->tenant_id)
            ->with(['schedules','linkedUser'])
            ->when(!$request->boolean('includeInactive'), fn($q) => $q->where('is_active', true))
            ->when($request->search, fn($q,$s) =>
                $q->where(function($q) use ($s) {
                    $q->where('name','like',"%{$s}%")
                      ->orWhere('specialization','like',"%{$s}%");
                })
            )
            ->orderBy('name')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'           => 'required|string',
            'consultationFee'=> 'nullable|numeric|min:0',
            'linkedUserId'   => 'nullable|uuid',
        ]);

        if ($request->linkedUserId) {
            $existing = Doctor::where('linked_user_id', $request->linkedUserId)->first();
            if ($existing) throw new ConflictException('This user is already linked to another doctor.');
        }

        $doctor = Doctor::create([
            'id'                   => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id'            => $request->user()->tenant_id,
            'linked_user_id'       => $request->linkedUserId,
            'name'                 => $request->name,
            'specialization'       => $request->specialization,
            'phone'                => $request->phone,
            'email'                => $request->email,
            'room_number'          => $request->roomNumber,
            'consultation_fee'     => $request->consultationFee ?? 0,
            'max_daily_appointments' => $request->maxDailyAppointments ?? 30,
            'lab_commission_pct'   => $request->labCommissionPct ?? 0,
            'checkup_commission_pct' => $request->checkupCommissionPct ?? 0,
        ]);

        return $doctor->load(['schedules','linkedUser']);
    }

    public function show(Request $request, string $id)
    {
        $doctor = Doctor::with(['schedules','linkedUser','appointments'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$doctor) throw new NotFoundException("Doctor {$id} not found.");
        return $doctor;
    }

    public function update(Request $request, string $id)
    {
        $doctor = Doctor::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$doctor) throw new NotFoundException("Doctor {$id} not found.");

        if ($request->linkedUserId && $request->linkedUserId !== $doctor->linked_user_id) {
            $existing = Doctor::where('linked_user_id', $request->linkedUserId)->first();
            if ($existing) throw new ConflictException('This user is already linked to another doctor.');
        }

        $doctor->update(array_filter([
            'linked_user_id'          => $request->linkedUserId,
            'name'                    => $request->name,
            'specialization'          => $request->specialization,
            'phone'                   => $request->phone,
            'email'                   => $request->email,
            'room_number'             => $request->roomNumber,
            'consultation_fee'        => $request->consultationFee,
            'is_active'               => $request->isActive,
            'max_daily_appointments'  => $request->maxDailyAppointments,
            'lab_commission_pct'      => $request->labCommissionPct,
            'checkup_commission_pct'  => $request->checkupCommissionPct,
        ], fn($v) => $v !== null));

        return $doctor->load(['schedules','linkedUser']);
    }

    public function destroy(Request $request, string $id)
    {
        $doctor = Doctor::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$doctor) throw new NotFoundException("Doctor {$id} not found.");
        $doctor->update(['is_active' => false]);
        return response()->json(['message' => 'Doctor deactivated.']);
    }

    public function linkableUsers(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $linkedUserIds = Doctor::where('tenant_id', $tenantId)
            ->whereNotNull('linked_user_id')
            ->pluck('linked_user_id');

        return User::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->whereNotIn('id', $linkedUserIds)
            ->select('id', 'full_name', 'username', 'email')
            ->orderBy('full_name')
            ->get();
    }

    public function getSchedule(Request $request, string $id)
    {
        $doctor = Doctor::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$doctor) throw new NotFoundException("Doctor {$id} not found.");
        return $doctor->schedules()->get();
    }

    public function updateSchedule(Request $request, string $id)
    {
        $request->validate([
            'schedules'           => 'required|array',
            'schedules.*.dayOfWeek'=> 'required|string',
            'schedules.*.startTime'=> 'required|string',
            'schedules.*.endTime'  => 'required|string',
        ]);

        $doctor = Doctor::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$doctor) throw new NotFoundException("Doctor {$id} not found.");

        return DB::transaction(function () use ($request, $doctor) {
            DoctorSchedule::where('doctor_id', $doctor->id)->delete();

            $schedules = [];
            foreach ($request->schedules as $sched) {
                $schedules[] = DoctorSchedule::create([
                    'id'         => (string) \Illuminate\Support\Str::uuid(),
                    'doctor_id'  => $doctor->id,
                    'day_of_week'=> $sched['dayOfWeek'],
                    'start_time' => $sched['startTime'],
                    'end_time'   => $sched['endTime'],
                ]);
            }

            return $schedules;
        });
    }
}
