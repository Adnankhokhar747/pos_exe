<?php

namespace App\Http\Controllers\Hospital;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Patient;
use App\Models\PatientLedgerEntry;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\InsufficientBalanceError;

class PatientsController extends Controller
{
    public function index(Request $request)
    {
        return Patient::where('tenant_id', $request->user()->tenant_id)
            ->when(!$request->boolean('includeInactive'), fn($q) => $q->where('is_active', true))
            ->when($request->search, fn($q,$s) =>
                $q->where(function($q) use ($s) {
                    $q->where('name','ilike',"%{$s}%")
                      ->orWhere('phone','ilike',"%{$s}%");
                })
            )
            ->orderBy('name')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string']);

        return Patient::create([
            'id'           => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id'    => $request->user()->tenant_id,
            'name'         => $request->name,
            'phone'        => $request->phone,
            'gender'       => $request->gender,
            'date_of_birth'=> $request->dateOfBirth,
            'address'      => $request->address,
        ]);
    }

    public function show(Request $request, string $id)
    {
        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");
        return $patient;
    }

    public function update(Request $request, string $id)
    {
        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");

        $patient->update(array_filter([
            'name'         => $request->name,
            'phone'        => $request->phone,
            'gender'       => $request->gender,
            'date_of_birth'=> $request->dateOfBirth,
            'address'      => $request->address,
            'is_active'    => $request->isActive,
        ], fn($v) => $v !== null));

        return $patient;
    }

    public function destroy(Request $request, string $id)
    {
        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");
        $patient->update(['is_active' => false]);
        return response()->json(['message' => 'Patient deactivated.']);
    }

    public function recordAdvance(Request $request, string $id)
    {
        $request->validate([
            'payments'          => 'required|array|min:1',
            'payments.*.method' => 'required|string',
            'payments.*.amount' => 'required|numeric|min:0.01',
        ]);

        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");

        return DB::transaction(function () use ($request, $patient) {
            $total = collect($request->payments)->sum('amount');
            $methodsSummary = collect($request->payments)
                ->map(fn($p) => "{$p['amount']} via {$p['method']}" . (isset($p['reference']) ? " ({$p['reference']})" : ''))
                ->join(', ');

            $newBalance = (float)$patient->current_balance + $total;
            $patient->update(['current_balance' => $newBalance]);

            return PatientLedgerEntry::create([
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'    => $patient->tenant_id,
                'patient_id'   => $patient->id,
                'entry_type'   => 'advance',
                'amount'       => $total,
                'balance_after'=> $newBalance,
                'description'  => $request->notes ?? "Advance deposit: {$methodsSummary}",
                'created_by'   => $request->user()->id,
            ]);
        });
    }

    public function refund(Request $request, string $id)
    {
        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string',
        ]);

        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");

        return DB::transaction(function () use ($request, $patient) {
            $amount = (float)$request->amount;
            if ($amount > (float)$patient->current_balance) {
                throw new InsufficientBalanceError("Refund ({$amount}) exceeds patient balance ({$patient->current_balance}).");
            }

            $newBalance = (float)$patient->current_balance - $amount;
            $patient->update(['current_balance' => $newBalance]);

            return PatientLedgerEntry::create([
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'    => $patient->tenant_id,
                'patient_id'   => $patient->id,
                'entry_type'   => 'refund',
                'amount'       => -$amount,
                'balance_after'=> $newBalance,
                'description'  => $request->notes ?? "Refund via {$request->method}",
                'created_by'   => $request->user()->id,
            ]);
        });
    }

    public function settleTreatment(Request $request, string $id)
    {
        $request->validate(['method' => 'required|string']);

        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");

        return DB::transaction(function () use ($request, $patient) {
            $balance = (float)$patient->current_balance;
            if ($balance == 0) {
                return ['patient' => $patient, 'action' => 'none', 'amount' => '0.00'];
            }

            $patient->update(['current_balance' => 0]);

            if ($balance > 0) {
                PatientLedgerEntry::create([
                    'id'           => (string) \Illuminate\Support\Str::uuid(),
                    'tenant_id'    => $patient->tenant_id,
                    'patient_id'   => $patient->id,
                    'entry_type'   => 'refund',
                    'amount'       => -$balance,
                    'balance_after'=> 0,
                    'description'  => "Treatment completed — advance balance refunded via {$request->method}",
                    'created_by'   => $request->user()->id,
                ]);
                return ['patient' => $patient->fresh(), 'action' => 'refunded', 'amount' => number_format($balance, 2)];
            }

            $owed = abs($balance);
            PatientLedgerEntry::create([
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'    => $patient->tenant_id,
                'patient_id'   => $patient->id,
                'entry_type'   => 'advance',
                'amount'       => $owed,
                'balance_after'=> 0,
                'description'  => "Treatment completed — final payment collected via {$request->method}",
                'created_by'   => $request->user()->id,
            ]);
            return ['patient' => $patient->fresh(), 'action' => 'collected', 'amount' => number_format($owed, 2)];
        });
    }

    public function ledger(Request $request, string $id)
    {
        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");

        return PatientLedgerEntry::where('patient_id', $id)
            ->orderByDesc('occurred_at')
            ->limit(200)
            ->get();
    }

    public function posInvoices(Request $request, string $id)
    {
        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");

        return Invoice::where('patient_id', $id)
            ->where('status', 'completed')
            ->with(['lines.product'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
    }

    public function appointments(Request $request, string $id)
    {
        $patient = Patient::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$patient) throw new NotFoundException("Patient {$id} not found.");

        return $patient->appointments()->with(['doctor','bill'])->orderByDesc('appointment_date')->get();
    }
}
