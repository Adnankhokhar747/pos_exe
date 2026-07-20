<?php

namespace App\Http\Controllers\Lab;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Exceptions\NotFoundException;

class LabCommissionsController extends Controller
{
    /**
     * GET /api/v1/hospital/lab/commissions
     * Per-doctor commission dashboard: earned vs paid vs balance.
     */
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $rows = DB::select("
            SELECT
                d.id                                                                AS doctor_id,
                d.name                                                              AS doctor_name,
                d.specialization,
                d.lab_commission_pct,
                COUNT(DISTINCT lo.id)                                               AS orders_count,
                COALESCE(SUM(lo.total_amount), 0)                                   AS total_lab_amount,
                COALESCE(SUM(lo.total_amount * d.lab_commission_pct / 100), 0)      AS commission_earned,
                COALESCE((
                    SELECT SUM(p.amount) FROM lab_commission_payments p
                    WHERE p.doctor_id = d.id AND p.tenant_id = ?
                ), 0)                                                               AS total_paid
            FROM doctors d
            LEFT JOIN lab_orders lo
                ON lo.doctor_id = d.id
               AND lo.tenant_id = d.tenant_id
               AND lo.status    = 'completed'
            WHERE d.tenant_id = ?
              AND d.is_active   = 1
            GROUP BY d.id, d.name, d.specialization, d.lab_commission_pct
            ORDER BY d.name
        ", [$tenantId, $tenantId]);

        return array_map(function ($r) {
            $r = (array) $r;
            $earned = (float) $r['commission_earned'];
            $paid   = (float) $r['total_paid'];
            return [
                'doctorId'         => $r['doctor_id'],
                'doctorName'       => $r['doctor_name'],
                'specialization'   => $r['specialization'],
                'labCommissionPct' => (float) $r['lab_commission_pct'],
                'ordersCount'      => (int)   $r['orders_count'],
                'totalLabAmount'   => (float) $r['total_lab_amount'],
                'commissionEarned' => $earned,
                'totalPaid'        => $paid,
                'balanceDue'       => max(0.0, $earned - $paid),
            ];
        }, $rows);
    }

    /**
     * POST /api/v1/hospital/lab/commissions/payments
     * Record a commission cash-out to a doctor.
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

        DB::table('lab_commission_payments')->insert([
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
     * GET /api/v1/hospital/lab/commissions/:doctorId/payments
     * Payment history for a specific doctor.
     */
    public function paymentHistory(Request $request, string $doctorId)
    {
        $tenantId = $request->user()->tenant_id;

        $doctor = DB::table('doctors')
            ->where('tenant_id', $tenantId)->where('id', $doctorId)->first();
        if (!$doctor) throw new NotFoundException('Doctor not found.');

        return DB::table('lab_commission_payments')
            ->where('tenant_id', $tenantId)
            ->where('doctor_id', $doctorId)
            ->orderByDesc('paid_at')
            ->get();
    }
}
