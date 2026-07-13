<?php

namespace App\Http\Controllers\Hospital;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Models\Doctor;

class QueueController extends Controller
{
    public function queue(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $date = $request->date ?? now()->toDateString();

        // Scope to own doctor if not viewAll
        $doctorId = $request->doctorId;
        if (!$request->user()->hasPermission('hospital.appointment.viewAll')) {
            $myDoctor = Doctor::where('linked_user_id', $request->user()->id)->first();
            if ($myDoctor) {
                $doctorId = $myDoctor->id;
            }
        }

        $appts = Appointment::where('tenant_id', $tenantId)
            ->where('appointment_date', $date)
            ->when($doctorId, fn($q,$d) => $q->where('doctor_id',$d))
            ->orderBy('token_number')
            ->get();

        $completed = $appts->where('status', 'completed');
        $waiting   = $appts->whereIn('status', ['confirmed','booked']);

        $currentToken = $completed->count() > 0 ? $completed->max('token_number') : 0;
        $nextToken    = $waiting->count() > 0 ? $waiting->min('token_number') : null;

        return response()->json([
            'currentToken'   => $currentToken,
            'nextToken'      => $nextToken,
            'waitingCount'   => $waiting->count(),
            'completedCount' => $completed->count(),
            'date'           => $date,
            'doctorId'       => $doctorId,
        ]);
    }
}
