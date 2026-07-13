<?php

namespace App\Http\Controllers\Hospital;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Models\AppointmentBill;
use App\Models\AppointmentBillLine;
use App\Models\AppointmentBillPayment;
use App\Models\Doctor;
use App\Models\Patient;
use App\Models\PatientLedgerEntry;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\BillAlreadyFinalizedError;
use App\Exceptions\InsufficientBalanceError;

class AppointmentBillingController extends Controller
{
    public function getBill(Request $request, string $appointmentId)
    {
        $appt = Appointment::where('tenant_id', $request->user()->tenant_id)->find($appointmentId);
        if (!$appt) throw new NotFoundException("Appointment not found.");

        return AppointmentBill::with(['lines.product','payments'])
            ->where('appointment_id', $appointmentId)
            ->first();
    }

    public function saveDraft(Request $request, string $appointmentId)
    {
        $request->validate([
            'consultationFee' => 'required|numeric|min:0',
            'medicineLines'   => 'array',
        ]);

        $appt = Appointment::where('tenant_id', $request->user()->tenant_id)->find($appointmentId);
        if (!$appt) throw new NotFoundException("Appointment not found.");
        if ($appt->status !== 'confirmed') {
            throw new \App\Exceptions\ConflictException("Appointment must be confirmed to bill.");
        }

        return DB::transaction(function () use ($request, $appt) {
            $medicineLines = $request->medicineLines ?? [];
            $medicineTotal = collect($medicineLines)->sum(fn($l) => ($l['quantity'] ?? 1) * ($l['unitPrice'] ?? 0));
            $totalDue = (float)$request->consultationFee + $medicineTotal;

            $lineData = $this->buildLineData($request->consultationFee, $medicineLines, $appt);

            $existing = AppointmentBill::where('appointment_id', $appt->id)->first();
            if ($existing) {
                if (!$existing->is_draft) throw new BillAlreadyFinalizedError();
                AppointmentBillLine::where('bill_id', $existing->id)->delete();
                $existing->update([
                    'consultation_fee' => $request->consultationFee,
                    'medicine_total'   => $medicineTotal,
                    'total_due'        => $totalDue,
                    'notes'            => $request->notes,
                ]);
                foreach ($lineData as $line) {
                    AppointmentBillLine::create(array_merge(['id' => (string) \Illuminate\Support\Str::uuid(), 'bill_id' => $existing->id], $line));
                }
                return $existing->load(['lines.product','payments']);
            }

            $bill = AppointmentBill::create([
                'id'              => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'       => $appt->tenant_id,
                'appointment_id'  => $appt->id,
                'is_draft'        => true,
                'consultation_fee'=> $request->consultationFee,
                'medicine_total'  => $medicineTotal,
                'total_due'       => $totalDue,
                'advance_applied' => 0,
                'total_collected' => 0,
                'advance_credited'=> 0,
                'patient_balance' => 0,
                'notes'           => $request->notes,
                'finalized_by'    => $request->user()->id,
            ]);

            foreach ($lineData as $line) {
                AppointmentBillLine::create(array_merge(['id' => (string) \Illuminate\Support\Str::uuid(), 'bill_id' => $bill->id], $line));
            }

            return $bill->load(['lines.product','payments']);
        });
    }

    public function finalizeBill(Request $request, string $appointmentId)
    {
        $request->validate([
            'consultationFee' => 'required|numeric|min:0',
            'advanceApplied'  => 'required|numeric|min:0',
            'payments'        => 'required|array',
            'medicineLines'   => 'array',
        ]);

        $appt = Appointment::where('tenant_id', $request->user()->tenant_id)->find($appointmentId);
        if (!$appt) throw new NotFoundException("Appointment not found.");
        if ($appt->status !== 'confirmed') {
            throw new \App\Exceptions\ConflictException("Appointment must be confirmed to finalize bill.");
        }

        $existing = AppointmentBill::where('appointment_id', $appt->id)->first();
        if ($existing && !$existing->is_draft) throw new BillAlreadyFinalizedError();

        return DB::transaction(function () use ($request, $appt, $existing) {
            $patient = Patient::findOrFail($appt->patient_id);
            $patientBalance = (float)$patient->current_balance;

            $medicineLines = $request->medicineLines ?? [];
            $medicineTotal = collect($medicineLines)->sum(fn($l) => ($l['quantity'] ?? 1) * ($l['unitPrice'] ?? 0));
            $totalDue = (float)$request->consultationFee + $medicineTotal;

            $advanceApplied = min((float)$request->advanceApplied, $patientBalance, $totalDue);
            $remainingDue   = $totalDue - $advanceApplied;
            $totalCollected = collect($request->payments)->sum('amount');
            $advanceCredited= max(0, $totalCollected - $remainingDue);
            $netCollected   = $totalCollected - $advanceCredited;

            $patientBalanceAfter = $patientBalance - $advanceApplied + $advanceCredited;
            $lineData = $this->buildLineData($request->consultationFee, $medicineLines, $appt);

            if ($existing) {
                AppointmentBillLine::where('bill_id', $existing->id)->delete();
                AppointmentBillPayment::where('bill_id', $existing->id)->delete();
                $bill = $existing;
                $bill->update([
                    'is_draft'        => false,
                    'consultation_fee'=> $request->consultationFee,
                    'medicine_total'  => $medicineTotal,
                    'total_due'       => $totalDue,
                    'advance_applied' => $advanceApplied,
                    'total_collected' => $netCollected,
                    'advance_credited'=> $advanceCredited,
                    'patient_balance' => $patientBalanceAfter,
                    'notes'           => $request->notes,
                    'finalized_by'    => $request->user()->id,
                    'finalized_at'    => now(),
                ]);
            } else {
                $bill = AppointmentBill::create([
                    'id'              => (string) \Illuminate\Support\Str::uuid(),
                    'tenant_id'       => $appt->tenant_id,
                    'appointment_id'  => $appt->id,
                    'is_draft'        => false,
                    'consultation_fee'=> $request->consultationFee,
                    'medicine_total'  => $medicineTotal,
                    'total_due'       => $totalDue,
                    'advance_applied' => $advanceApplied,
                    'total_collected' => $netCollected,
                    'advance_credited'=> $advanceCredited,
                    'patient_balance' => $patientBalanceAfter,
                    'notes'           => $request->notes,
                    'finalized_by'    => $request->user()->id,
                    'finalized_at'    => now(),
                ]);
            }

            foreach ($lineData as $line) {
                AppointmentBillLine::create(array_merge(['id' => (string) \Illuminate\Support\Str::uuid(), 'bill_id' => $bill->id], $line));
            }

            foreach ($request->payments as $pay) {
                AppointmentBillPayment::create([
                    'id'        => (string) \Illuminate\Support\Str::uuid(),
                    'bill_id'   => $bill->id,
                    'method'    => $pay['method'],
                    'amount'    => $pay['amount'],
                    'reference' => $pay['reference'] ?? null,
                ]);
            }

            $patient->update(['current_balance' => $patientBalanceAfter]);

            if ($advanceApplied > 0) {
                $parts = ["Consultation fee: {$request->consultationFee}"];
                if ($medicineTotal > 0) $parts[] = "clinic charges: {$medicineTotal}";
                PatientLedgerEntry::create([
                    'id'            => (string) \Illuminate\Support\Str::uuid(),
                    'tenant_id'     => $appt->tenant_id,
                    'patient_id'    => $appt->patient_id,
                    'appointment_id'=> $appt->id,
                    'entry_type'    => 'charge',
                    'amount'        => -$advanceApplied,
                    'balance_after' => $patientBalanceAfter - $advanceCredited,
                    'description'   => "Advance deducted — Token #{$appt->token_number} (" . implode(', ', $parts) . ")",
                    'created_by'    => $request->user()->id,
                ]);
            }

            if ($advanceCredited > 0) {
                PatientLedgerEntry::create([
                    'id'            => (string) \Illuminate\Support\Str::uuid(),
                    'tenant_id'     => $appt->tenant_id,
                    'patient_id'    => $appt->patient_id,
                    'appointment_id'=> $appt->id,
                    'entry_type'    => 'advance',
                    'amount'        => $advanceCredited,
                    'balance_after' => $patientBalanceAfter,
                    'description'   => "Advance credited from overpayment — Token #{$appt->token_number}",
                    'created_by'    => $request->user()->id,
                ]);
            }

            $appt->update(['status' => 'completed', 'completed_at' => now()]);

            return $bill->load(['lines.product','payments']);
        });
    }

    private function buildLineData(float $consultationFee, array $medicineLines, Appointment $appt): array
    {
        $doctor = $appt->doctor ?? Doctor::find($appt->doctor_id);
        $lines = [[
            'line_type'   => 'consultation',
            'description' => "Consultation — " . ($doctor->name ?? 'Doctor'),
            'quantity'    => 1,
            'unit_price'  => $consultationFee,
            'line_total'  => $consultationFee,
        ]];

        foreach ($medicineLines as $l) {
            $lineTotal = ($l['quantity'] ?? 1) * ($l['unitPrice'] ?? 0);
            $lines[] = [
                'line_type'   => 'medicine',
                'product_id'  => $l['productId'] ?? null,
                'description' => $l['description'] ?? '',
                'quantity'    => $l['quantity'] ?? 1,
                'unit_price'  => $l['unitPrice'] ?? 0,
                'line_total'  => $lineTotal,
            ];
        }

        return $lines;
    }
}
