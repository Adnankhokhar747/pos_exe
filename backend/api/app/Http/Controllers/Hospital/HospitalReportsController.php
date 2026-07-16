<?php

namespace App\Http\Controllers\Hospital;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Models\AppointmentBill;
use App\Models\Patient;
use App\Models\Doctor;
use Illuminate\Support\Facades\DB;

class HospitalReportsController extends Controller
{
    public function counts(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $totalPatients = Patient::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->count();

        $totalDoctors = Doctor::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->count();

        return response()->json([
            'totalPatients' => $totalPatients,
            'totalDoctors'  => $totalDoctors,
        ]);
    }

    public function summary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $from  = $request->from ?? now()->startOfMonth()->toDateString();
        $to    = $request->to ?? now()->toDateString();

        $appts = Appointment::where('tenant_id', $tenantId)
            ->whereBetween('appointment_date', [$from, $to])
            ->when($request->doctorId, fn($q,$d) => $q->where('doctor_id',$d))
            ->get();

        return response()->json([
            'advanceBookingCount' => $appts->where('appointment_type','advance')->count(),
            'walkInCount'         => $appts->where('appointment_type','walk_in')->count(),
            'completedCount'      => $appts->where('status','completed')->count(),
            'cancelledCount'      => $appts->where('status','cancelled')->count(),
            'noShowCount'         => $appts->where('status','no_show')->count(),
            'totalCount'          => $appts->count(),
            'from'                => $from,
            'to'                  => $to,
        ]);
    }

    public function dailyPatients(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $date = $request->date ?? now()->toDateString();

        $appts = Appointment::where('tenant_id', $tenantId)
            ->where('appointment_date', $date)
            ->where('status', 'completed')
            ->when($request->doctorId, fn($q,$d) => $q->where('doctor_id',$d))
            ->with('doctor:id,name')
            ->get();

        // Return flat array so dashboard can iterate directly
        return response()->json(
            $appts->groupBy('doctor_id')->map(fn($g) => [
                'doctorId'    => $g->first()->doctor_id,
                'doctorName'  => $g->first()->doctor->name ?? 'Unknown',
                'patientCount'=> $g->count(),
            ])->values()
        );
    }

    public function monthlyPatients(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $month = $request->month ?? now()->format('Y-m');
        [$year, $mon] = explode('-', $month);

        $appts = Appointment::where('tenant_id', $tenantId)
            ->whereYear('appointment_date', $year)
            ->whereMonth('appointment_date', $mon)
            ->where('status', 'completed')
            ->when($request->doctorId, fn($q,$d) => $q->where('doctor_id',$d))
            ->get();

        return response()->json([
            'month'        => $month,
            'patientCount' => $appts->count(),
        ]);
    }

    public function revenue(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $from = $request->from ?? now()->startOfMonth()->toDateString();
        $to   = $request->to ?? now()->toDateString();

        $bills = DB::table('appointment_bills as ab')
            ->join('appointments as a', 'a.id', '=', 'ab.appointment_id')
            ->join('doctors as d', 'd.id', '=', 'a.doctor_id')
            ->where('a.tenant_id', $tenantId)
            ->where('ab.is_draft', false)
            ->whereNotNull('ab.finalized_at')
            ->whereBetween('a.appointment_date', [$from, $to])
            ->when($request->doctorId, fn($q,$id) => $q->where('a.doctor_id', $id))
            ->select(
                'd.id as doctor_id',
                'd.name as doctor_name',
                DB::raw('COUNT(ab.id) as bill_count'),
                DB::raw('SUM(ab.total_due) as total_revenue')
            )
            ->groupBy('d.id', 'd.name')
            ->get();

        return response()->json([
            'from'         => $from,
            'to'           => $to,
            'totalRevenue' => $bills->sum('total_revenue'),
            'byDoctor'     => $bills,
        ]);
    }
}
