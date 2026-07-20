<?php

namespace App\Http\Controllers\Hospital;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Exceptions\NotFoundException;

class CheckupCommissionsController extends Controller
{
    /**
     * GET /api/v1/hospital/checkup-commissions
     * Per-doctor checkup commission dashboard: earned vs paid vs balance.
     * Commission is calculated from finalized appointment_bills.consultation_fee.
     */
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $rows = DB::select("
            SELECT
                d.id                                                                        AS doctor_id,
                d.name                                                                      AS doctor_name,
                d.specialization,
                d.checkup_commission_pct,
                COUNT(DISTINCT ab.id)                                                       AS appointments_count,
                COALESCE(SUM(ab.consultation_fee), 0)                                       AS total_consultation,
                COALESCE(SUM(ab.consultation_fee * d.checkup_commission_pct / 100), 0)      AS commission_earned,
                COALESCE((
                    SELECT SUM(p.amount) FROM checkup_commission_payments p
                    WHERE p.doctor_id = d.id AND p.tenant_id = ?
                ), 0)                                                                       AS total_paid
            FROM doctors d
            LEFT JOIN appointments a
                ON a.doctor_id  = d.id
               AND a.tenant_id  = d.tenant_id
               AND a.status     = 'completed'
            LEFT JOIN appointment_bills ab
                ON ab.appointment_id = a.id
               AND ab.is_draft        = 0
               AND ab.finalized_at   IS NOT NULL
            WHERE d.tenant_id = ?
              AND d.is_active   = 1
            GROUP BY d.id, d.name, d.specialization, d.checkup_commission_pct
            ORDER BY d.name
        ", [$tenantId, $tenantId]);

        return array_map(function ($r) {
            $r       = (array) $r;
            $earned  = (float) $r['commission_earned'];
            $paid    = (float) $r['total_paid'];
            return [
                'doctorId'            => $r['doctor_id'],
                'doctorName'          => $r['doctor_name'],
                'specialization'      => $r['specialization'],
                'checkupCommissionPct'=> (float) $r['checkup_commission_pct'],
                'appointmentsCount'   => (int)   $r['appointments_count'],
                'totalConsultation'   => (float) $r['total_consultation'],
                'commissionEarned'    => $earned,
                'totalPaid'           => $paid,
                'balanceDue'          => max(0.0, $earned - $paid),
            ];
        }, $rows);
    }

    /**
     * POST /api/v1/hospital/checkup-commissions/payments
     * Record a commission cash-out to a doctor for consultation fees.
     */
    public function recordPayment(Request $request)
    {
        $request->validate([
            'doctorId' => 'required|uuid',
            'amount'   => 'required|numeric|min:0.01',
            'method'   => 'nullable|in:cash,bank_transfer,cheque,other',
            'notes'    => 'nullable|string|max:1000',
        ]);

        $tenantId = $request->user()->tenant_id;

        $doctor = DB::table('doctors')
            ->where('tenant_id', $tenantId)
            ->where('id', $request->doctorId)
            ->first();
        if (!$doctor) throw new NotFoundException('Doctor not found.');

        DB::table('checkup_commission_payments')->insert([
            'id'         => (string) Str::uuid(),
            'tenant_id'  => $tenantId,
            'doctor_id'  => $request->doctorId,
            'amount'     => $request->amount,
            'method'     => $request->method ?? 'cash',
            'notes'      => $request->notes,
            'paid_at'    => now(),
            'created_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Payment recorded.'], 201);
    }

    /**
     * GET /api/v1/hospital/checkup-commissions/:doctorId/payments
     * Payment history for a specific doctor.
     */
    public function paymentHistory(Request $request, string $doctorId)
    {
        $tenantId = $request->user()->tenant_id;

        $doctor = DB::table('doctors')
            ->where('tenant_id', $tenantId)->where('id', $doctorId)->first();
        if (!$doctor) throw new NotFoundException('Doctor not found.');

        return DB::table('checkup_commission_payments')
            ->where('tenant_id', $tenantId)
            ->where('doctor_id', $doctorId)
            ->orderByDesc('paid_at')
            ->get();
    }
}
