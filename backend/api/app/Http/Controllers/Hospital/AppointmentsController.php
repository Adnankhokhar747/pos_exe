<?php

namespace App\Http\Controllers\Hospital;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;
use App\Exceptions\InvalidStatusTransitionError;
use App\Exceptions\LimitExceededError;
use App\Models\TenantModule;
use App\Models\ModuleCatalog;

class AppointmentsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $scope = $this->resolveScope($request);

        return Appointment::where('tenant_id', $tenantId)
            ->with(['doctor','patient','bill'])
            ->when($scope['doctorId'], fn($q,$d) => $q->where('doctor_id',$d))
            ->when($request->date, fn($q,$d) => $q->where('appointment_date',$d))
            ->when($request->status, fn($q,$s) => $q->where('status',$s))
            ->when($request->type, fn($q,$t) => $q->where('appointment_type',$t))
            ->when($request->from, fn($q,$f) => $q->where('appointment_date','>=',$f))
            ->when($request->to, fn($q,$t) => $q->where('appointment_date','<=',$t))
            ->orderBy('appointment_date','desc')
            ->orderBy('token_number')
            ->limit(500)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'patientId'       => 'required|uuid',
            'doctorId'        => 'required|uuid',
            'appointmentType' => 'required|in:walk_in,advance',
            'appointmentDate' => 'nullable|date',
        ]);

        $tenantId = $request->user()->tenant_id;
        $doctor = Doctor::where('tenant_id', $tenantId)->find($request->doctorId);
        if (!$doctor) throw new NotFoundException("Doctor not found.");
        $patient = Patient::where('tenant_id', $tenantId)->find($request->patientId);
        if (!$patient) throw new NotFoundException("Patient not found.");

        $this->checkModuleLimits($tenantId);

        $apptDate = $request->appointmentDate
            ? \Carbon\Carbon::parse($request->appointmentDate)->toDateString()
            : now()->toDateString();

        $status = $request->appointmentType === 'walk_in' ? 'confirmed' : 'booked';

        return DB::transaction(function () use ($request, $tenantId, $apptDate, $status) {
            $tokenNumber = $this->issueToken($request->doctorId, $apptDate);

            return Appointment::create([
                'id'              => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'       => $tenantId,
                'doctor_id'       => $request->doctorId,
                'patient_id'      => $request->patientId,
                'appointment_type'=> $request->appointmentType,
                'status'          => $status,
                'appointment_date'=> $apptDate,
                'token_number'    => $tokenNumber,
                'booked_at'       => now(),
                'notes'           => $request->notes,
                'created_by'      => $request->user()->id,
            ])->load(['doctor','patient']);
        });
    }

    public function show(Request $request, string $id)
    {
        $appt = Appointment::with(['doctor','patient','bill.lines','bill.payments'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$appt) throw new NotFoundException("Appointment {$id} not found.");
        return $appt;
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate([
            'status'       => 'required|in:confirmed,completed,cancelled,no_show',
            'cancelReason' => 'nullable|string',
        ]);

        $appt = Appointment::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$appt) throw new NotFoundException("Appointment {$id} not found.");

        $this->validateTransition($appt->status, $request->status);

        $data = ['status' => $request->status];
        if ($request->status === 'confirmed') $data['arrived_at'] = now();
        if ($request->status === 'completed')  $data['completed_at'] = now();
        if (in_array($request->status, ['cancelled','no_show'])) {
            $data['cancelled_at'] = now();
            $data['cancel_reason'] = $request->cancelReason;
        }

        $appt->update($data);
        return $appt->load(['doctor','patient','bill']);
    }

    private function issueToken(string $doctorId, string $date): int
    {
        $maxRetries = 3;
        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            try {
                $max = Appointment::where('doctor_id', $doctorId)
                    ->where('appointment_date', $date)
                    ->max('token_number') ?? 0;
                $next = $max + 1;

                // The unique constraint will catch duplicates
                return $next;
            } catch (\Illuminate\Database\QueryException $e) {
                if ($attempt === $maxRetries - 1) throw $e;
                // retry on unique violation
            }
        }
        return 1;
    }

    private function validateTransition(string $from, string $to): void
    {
        $legal = [
            'booked'    => ['confirmed','cancelled'],
            'confirmed' => ['completed','no_show','cancelled'],
        ];

        if (!isset($legal[$from]) || !in_array($to, $legal[$from])) {
            throw new InvalidStatusTransitionError("Cannot transition appointment from '{$from}' to '{$to}'.");
        }
    }

    private function resolveScope(Request $request): array
    {
        $user = $request->user();
        if ($user->hasPermission('hospital.appointment.viewAll')) {
            return ['doctorId' => $request->doctorId, 'viewAll' => true];
        }

        $doctor = Doctor::where('linked_user_id', $user->id)->first();
        if ($doctor) {
            return ['doctorId' => $doctor->id, 'viewAll' => false];
        }

        return ['doctorId' => $request->doctorId, 'viewAll' => true];
    }

    private function checkModuleLimits(string $tenantId): void
    {
        $catalog = ModuleCatalog::where('code', 'hospital')->first();
        if (!$catalog) return;

        $tm = TenantModule::where('tenant_id', $tenantId)->where('module_id', $catalog->id)->first();
        if (!$tm || !$tm->limits) return;

        $limits = $tm->limits;

        if (isset($limits['appointmentLimit'])) {
            $count = Appointment::where('tenant_id', $tenantId)->count();
            if ($count >= $limits['appointmentLimit']) {
                throw new LimitExceededError("Appointment limit of {$limits['appointmentLimit']} reached.");
            }
        }

        if (isset($limits['tokenLimitPerDay'])) {
            $today = now()->toDateString();
            $count = Appointment::where('tenant_id', $tenantId)->where('appointment_date', $today)->count();
            if ($count >= $limits['tokenLimitPerDay']) {
                throw new LimitExceededError("Daily token limit of {$limits['tokenLimitPerDay']} reached.");
            }
        }
    }
}
