<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\Appointment;
use App\Models\Doctor;
use Carbon\Carbon;

class BookingAppointmentController extends Controller
{
    public function myAppointments(Request $request)
    {
        /** @var \App\Models\PatientAccount $account */
        $account = $request->attributes->get('bookingAccount');

        $appointments = Appointment::where('patient_id', $account->patient_id)
            ->with(['doctor:id,name,specialization,room_number'])
            ->orderByDesc('appointment_date')
            ->orderBy('token_number')
            ->get()
            ->map(fn(Appointment $a) => [
                'id'              => $a->id,
                'appointmentDate' => $a->appointment_date?->toDateString(),
                'tokenNumber'     => $a->token_number,
                'status'          => $a->status,
                'appointmentType' => $a->appointment_type,
                'notes'           => $a->notes,
                'bookedAt'        => $a->booked_at?->toISOString(),
                'cancelledAt'     => $a->cancelled_at?->toISOString(),
                'cancelReason'    => $a->cancel_reason,
                'doctor'          => $a->doctor ? [
                    'id'             => $a->doctor->id,
                    'name'           => $a->doctor->name,
                    'specialization' => $a->doctor->specialization,
                    'room_number'    => $a->doctor->room_number,
                ] : null,
            ]);

        return response()->json($appointments);
    }

    public function book(Request $request)
    {
        /** @var \App\Models\PatientAccount $account */
        $account = $request->attributes->get('bookingAccount');

        $request->validate([
            'doctorId'       => 'required|uuid',
            'appointmentDate'=> 'required|date|after_or_equal:today',
            'notes'          => 'nullable|string|max:1000',
        ]);

        $tenantId       = $account->tenant_id;
        $patientId      = $account->patient_id;
        $doctorId       = $request->doctorId;
        $appointmentDate= Carbon::parse($request->appointmentDate)->toDateString();
        $dayOfWeek      = strtolower(Carbon::parse($appointmentDate)->format('l'));

        // Find doctor and verify it belongs to the same tenant
        $doctor = Doctor::where('id', $doctorId)
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->with('schedules')
            ->first();

        if (!$doctor) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'Doctor not found.',
            ], 404);
        }

        // Check doctor has a schedule for the requested day
        $hasSchedule = $doctor->schedules->contains('day_of_week', $dayOfWeek);
        if (!$hasSchedule) {
            return response()->json([
                'error'   => 'no_schedule',
                'message' => "The doctor does not have appointments on {$dayOfWeek}.",
            ], 422);
        }

        return DB::transaction(function () use (
            $doctor, $tenantId, $patientId, $doctorId, $appointmentDate, $dayOfWeek, $request
        ) {
            // Count active appointments for this doctor on this date (lock rows for update)
            $activeCount = Appointment::where('doctor_id', $doctorId)
                ->where('appointment_date', $appointmentDate)
                ->whereNotIn('status', ['cancelled', 'no_show'])
                ->lockForUpdate()
                ->count();

            // Check if slots are still available
            if ($activeCount >= $doctor->max_daily_appointments) {
                return response()->json([
                    'error'   => 'fully_booked',
                    'message' => 'No more appointment slots available for this date.',
                ], 422);
            }

            // Check patient doesn't already have an active appointment with this doctor on this date
            $duplicate = Appointment::where('doctor_id', $doctorId)
                ->where('patient_id', $patientId)
                ->where('appointment_date', $appointmentDate)
                ->whereNotIn('status', ['cancelled', 'no_show'])
                ->exists();

            if ($duplicate) {
                return response()->json([
                    'error'   => 'duplicate_appointment',
                    'message' => 'You already have an appointment with this doctor on this date.',
                ], 409);
            }

            $tokenNumber = $activeCount + 1;

            $appointment = Appointment::create([
                'id'               => (string) Str::uuid(),
                'tenant_id'        => $tenantId,
                'doctor_id'        => $doctorId,
                'patient_id'       => $patientId,
                'appointment_type' => 'advance',
                'status'           => 'booked',
                'appointment_date' => $appointmentDate,
                'token_number'     => $tokenNumber,
                'booked_at'        => now(),
                'notes'            => $request->notes,
                'created_by'       => null,
            ]);

            return response()->json([
                'id'              => $appointment->id,
                'doctorName'      => $doctor->name,
                'appointmentDate' => $appointmentDate,
                'tokenNumber'     => $tokenNumber,
                'status'          => $appointment->status,
            ], 201);
        });
    }

    public function cancel(Request $request, string $id)
    {
        /** @var \App\Models\PatientAccount $account */
        $account = $request->attributes->get('bookingAccount');

        $appointment = Appointment::where('id', $id)
            ->where('patient_id', $account->patient_id)
            ->first();

        if (!$appointment) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'Appointment not found.',
            ], 404);
        }

        if (!in_array($appointment->status, ['booked', 'confirmed'])) {
            return response()->json([
                'error'   => 'invalid_status',
                'message' => "Cannot cancel an appointment with status '{$appointment->status}'.",
            ], 422);
        }

        $appointment->update([
            'status'        => 'cancelled',
            'cancelled_at'  => now(),
            'cancel_reason' => 'Cancelled by patient online.',
        ]);

        return response()->json([
            'message' => 'Appointment cancelled successfully.',
        ]);
    }
}
