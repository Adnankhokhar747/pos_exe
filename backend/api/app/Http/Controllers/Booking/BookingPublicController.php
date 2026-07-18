<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksBookingModule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Doctor;
use App\Models\Appointment;
use App\Models\Tenant;
use Carbon\Carbon;

class BookingPublicController extends Controller
{
    use ChecksBookingModule;
    public function defaultTenant()
    {
        $tenant = Tenant::whereIn('status', ['active', 'trial', 'grace_period'])
            ->orderBy('created_at')
            ->first();
        if (!$tenant) {
            return response()->json(['message' => 'No active clinic found.'], 404);
        }
        return response()->json([
            'tenantId' => $tenant->id,
            'name'     => $tenant->name,
        ]);
    }

    public function doctors(Request $request)
    {
        $request->validate([
            'tenantId' => 'required|string',
        ]);

        if ($err = $this->bookingModuleCheck($request->tenantId)) return $err;

        $doctors = Doctor::where('tenant_id', $request->tenantId)
            ->where('is_active', true)
            ->with('schedules')
            ->get()
            ->map(function (Doctor $doctor) {
                return [
                    'id'                    => $doctor->id,
                    'name'                  => $doctor->name,
                    'specialization'        => $doctor->specialization,
                    'room_number'           => $doctor->room_number,
                    'consultation_fee'      => $doctor->consultation_fee,
                    'max_daily_appointments'=> $doctor->max_daily_appointments,
                    'schedules'             => $doctor->schedules->map(fn($s) => [
                        'day_of_week' => $s->day_of_week,
                        'start_time'  => $s->start_time,
                        'end_time'    => $s->end_time,
                    ])->values(),
                ];
            });

        return response()->json($doctors);
    }

    public function availability(Request $request, string $doctorId)
    {
        $request->validate([
            'tenantId' => 'required|string',
            'from'     => 'nullable|date',
            'to'       => 'nullable|date',
        ]);

        $tenantId = $request->tenantId;

        if ($err = $this->bookingModuleCheck($tenantId)) return $err;
        $from     = Carbon::parse($request->input('from', Carbon::today()->toDateString()))->startOfDay();
        $to       = Carbon::parse($request->input('to', Carbon::today()->addDays(30)->toDateString()))->startOfDay();

        $doctor = Doctor::where('id', $doctorId)
            ->where('tenant_id', $tenantId)
            ->with('schedules')
            ->first();

        if (!$doctor) {
            return response()->json(['error' => 'not_found', 'message' => 'Doctor not found.'], 404);
        }

        // Build a lookup: day_of_week => schedule
        $scheduleDays = [];
        foreach ($doctor->schedules as $schedule) {
            $scheduleDays[$schedule->day_of_week] = $schedule;
        }

        // Get appointment counts per date for this doctor (exclude cancelled/no_show)
        $countsByDate = Appointment::where('doctor_id', $doctorId)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->whereBetween('appointment_date', [$from->toDateString(), $to->toDateString()])
            ->select(DB::raw('appointment_date, COUNT(*) as cnt'))
            ->groupBy('appointment_date')
            ->pluck('cnt', 'appointment_date')
            ->toArray();

        $maxAppointments = $doctor->max_daily_appointments;
        $result          = [];

        $current = $from->copy();
        while ($current->lte($to)) {
            $dateStr   = $current->toDateString();
            $dayOfWeek = strtolower($current->format('l')); // e.g. "monday"

            $hasSchedule   = isset($scheduleDays[$dayOfWeek]);
            $bookedCount   = (int) ($countsByDate[$dateStr] ?? 0);
            $isAvailable   = $hasSchedule && ($bookedCount < $maxAppointments);
            $nextToken     = $isAvailable ? $bookedCount + 1 : null;

            $result[] = [
                'date'            => $dateStr,
                'dayOfWeek'       => $dayOfWeek,
                'available'       => $isAvailable,
                'bookedCount'     => $bookedCount,
                'maxAppointments' => $maxAppointments,
                'nextToken'       => $nextToken,
            ];

            $current->addDay();
        }

        return response()->json($result);
    }
}
