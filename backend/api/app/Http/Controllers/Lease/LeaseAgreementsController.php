<?php

namespace App\Http\Controllers\Lease;

use App\Http\Controllers\Controller;
use App\Models\LeaseAgreement;
use App\Models\LeaseInstallment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeaseAgreementsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $query = LeaseAgreement::where('tenant_id', $tenantId)
            ->with('customer:id,name,phone');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('customerId')) {
            $query->where('customer_id', $request->customerId);
        }

        $agreements = $query->orderByDesc('created_at')->get();

        // Attach paid-count summary per agreement
        $agreementIds = $agreements->pluck('id');
        $paidCounts = LeaseInstallment::whereIn('agreement_id', $agreementIds)
            ->where('status', 'paid')
            ->select('agreement_id', DB::raw('COUNT(*) as paid_count'), DB::raw('SUM(paid_amount) as total_paid'))
            ->groupBy('agreement_id')
            ->get()
            ->keyBy('agreement_id');

        return response()->json(
            $agreements->map(fn($a) => array_merge(
                $this->format($a),
                [
                    'paidInstallments' => (int) ($paidCounts[$a->id]->paid_count ?? 0),
                    'totalPaid'        => (float) ($paidCounts[$a->id]->total_paid ?? 0),
                ]
            ))
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'                => 'required|string|max:255',
            'category'             => 'required|in:property,vehicle,appliance,electronics,other',
            'customerId'           => 'required|uuid',
            'totalAmount'          => 'required|numeric|min:0.01',
            'downPayment'          => 'nullable|numeric|min:0',
            'installmentCount'     => 'required|integer|min:1|max:600',
            'frequency'            => 'required|in:weekly,monthly,quarterly,yearly',
            'startDate'            => 'required|date',
            'firstInstallmentDate' => 'required|date',
            'notes'                => 'nullable|string',
        ]);

        $tenantId       = $request->user()->tenant_id;
        $downPayment    = (float) ($validated['downPayment'] ?? 0);
        $totalAmount    = (float) $validated['totalAmount'];
        $financedAmount = max(0, $totalAmount - $downPayment);
        $count          = (int) $validated['installmentCount'];
        $baseAmt        = $count > 0 ? round($financedAmount / $count, 2) : 0;
        $lastAmt        = round($financedAmount - ($baseAmt * ($count - 1)), 2);

        $agreementId = Str::uuid()->toString();

        DB::transaction(function () use (
            $agreementId, $tenantId, $validated,
            $downPayment, $totalAmount, $financedAmount,
            $count, $baseAmt, $lastAmt, $request
        ) {
            LeaseAgreement::create([
                'id'                     => $agreementId,
                'tenant_id'              => $tenantId,
                'title'                  => $validated['title'],
                'category'               => $validated['category'],
                'customer_id'            => $validated['customerId'],
                'total_amount'           => $totalAmount,
                'down_payment'           => $downPayment,
                'financed_amount'        => $financedAmount,
                'installment_count'      => $count,
                'installment_amount'     => $baseAmt,
                'frequency'              => $validated['frequency'],
                'start_date'             => $validated['startDate'],
                'first_installment_date' => $validated['firstInstallmentDate'],
                'status'                 => 'active',
                'notes'                  => $validated['notes'] ?? null,
                'created_by'             => $request->user()->id,
            ]);

            $dueDate = Carbon::parse($validated['firstInstallmentDate']);
            for ($i = 1; $i <= $count; $i++) {
                LeaseInstallment::create([
                    'id'                 => Str::uuid()->toString(),
                    'tenant_id'          => $tenantId,
                    'agreement_id'       => $agreementId,
                    'installment_number' => $i,
                    'due_date'           => $dueDate->toDateString(),
                    'amount'             => ($i === $count) ? $lastAmt : $baseAmt,
                    'status'             => 'pending',
                ]);

                switch ($validated['frequency']) {
                    case 'weekly':    $dueDate->addWeek();    break;
                    case 'monthly':   $dueDate->addMonth();   break;
                    case 'quarterly': $dueDate->addMonths(3); break;
                    case 'yearly':    $dueDate->addYear();    break;
                }
            }
        });

        $agreement = LeaseAgreement::with('customer:id,name,phone')->findOrFail($agreementId);
        return response()->json($this->format($agreement), 201);
    }

    public function show(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $agreement = LeaseAgreement::where('tenant_id', $tenantId)
            ->with(['customer:id,name,phone', 'installments'])
            ->findOrFail($id);

        // Auto-mark overdue
        $today = Carbon::today()->toDateString();
        LeaseInstallment::where('agreement_id', $id)
            ->where('status', 'pending')
            ->where('due_date', '<', $today)
            ->update(['status' => 'overdue', 'updated_at' => now()]);

        // Refresh installments after potential overdue update
        $installments = LeaseInstallment::where('agreement_id', $id)
            ->orderBy('installment_number')
            ->get();

        $paid    = $installments->where('status', 'paid');
        $pending = $installments->whereIn('status', ['pending', 'partial', 'overdue']);

        $data = $this->format($agreement);
        $data['installments'] = $installments->map(fn($i) => $this->formatInstallment($i));
        $data['summary'] = [
            'totalPaid'    => (float) $paid->sum('paid_amount'),
            'totalPending' => (float) $pending->sum('amount'),
            'paidCount'    => $paid->count(),
            'pendingCount' => $pending->count(),
            'overdueCount' => $installments->where('status', 'overdue')->count(),
        ];

        return response()->json($data);
    }

    public function update(Request $request, string $id)
    {
        $agreement = LeaseAgreement::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'status' => 'sometimes|in:active,completed,cancelled,defaulted',
            'title'  => 'sometimes|string|max:255',
            'notes'  => 'nullable|string',
        ]);

        $agreement->update(array_filter($validated, fn($v) => $v !== null));

        return response()->json($this->format($agreement->fresh()->load('customer:id,name,phone')));
    }

    public function recordInstallmentPayment(Request $request, string $agreementId, string $installmentId)
    {
        $tenantId    = $request->user()->tenant_id;
        $installment = LeaseInstallment::with('agreement.customer')
            ->where('tenant_id', $tenantId)
            ->where('agreement_id', $agreementId)
            ->findOrFail($installmentId);

        $validated = $request->validate([
            'paidAmount'      => 'required|numeric|min:0.01',
            'paidDate'        => 'required|date',
            'paymentMethod'   => 'nullable|string|max:50',
            'referenceNumber' => 'nullable|string|max:100',
            'notes'           => 'nullable|string',
        ]);

        $status = ((float) $validated['paidAmount'] >= (float) $installment->amount) ? 'paid' : 'partial';

        $installment->update([
            'paid_amount'      => $validated['paidAmount'],
            'paid_date'        => $validated['paidDate'],
            'payment_method'   => $validated['paymentMethod'] ?? null,
            'reference_number' => $validated['referenceNumber'] ?? null,
            'status'           => $status,
            'notes'            => $validated['notes'] ?? null,
        ]);

        // Auto-complete agreement when all installments are paid
        $unpaidCount = LeaseInstallment::where('agreement_id', $agreementId)
            ->whereNotIn('status', ['paid'])
            ->count();

        if ($unpaidCount === 0) {
            LeaseAgreement::where('id', $agreementId)->update(['status' => 'completed']);
        }

        $fresh = $installment->fresh();

        // Send WhatsApp payment confirmation (best-effort)
        try {
            $customer = $installment->agreement?->customer;
            if ($customer?->phone) {
                $totalPending = LeaseInstallment::where('agreement_id', $agreementId)
                    ->whereIn('status', ['pending', 'partial', 'overdue'])
                    ->sum('amount');

                $businessName = app(\App\Services\WhatsApp\WhatsAppService::class)->getBusinessName($tenantId);
                app(\App\Services\WhatsApp\WhatsAppService::class)->sendInstallmentPaid($tenantId, [
                    'installmentId'    => $installment->id,
                    'customerName'     => $customer->name,
                    'customerPhone'    => $customer->phone,
                    'paidAmount'       => $validated['paidAmount'],
                    'remainingBalance' => $totalPending,
                    'businessName'     => $businessName,
                ]);
            }
        } catch (\Throwable) {
            // Never block payment recording
        }

        return response()->json($this->formatInstallment($fresh));
    }

    private function format(LeaseAgreement $a): array
    {
        return [
            'id'                   => $a->id,
            'title'                => $a->title,
            'category'             => $a->category,
            'customerId'           => $a->customer_id,
            'customerName'         => $a->customer?->name,
            'customerPhone'        => $a->customer?->phone,
            'totalAmount'          => (float) $a->total_amount,
            'downPayment'          => (float) $a->down_payment,
            'financedAmount'       => (float) $a->financed_amount,
            'installmentCount'     => (int) $a->installment_count,
            'installmentAmount'    => (float) $a->installment_amount,
            'frequency'            => $a->frequency,
            'startDate'            => $a->start_date?->toDateString(),
            'firstInstallmentDate' => $a->first_installment_date?->toDateString(),
            'status'               => $a->status,
            'notes'                => $a->notes,
            'createdAt'            => $a->created_at?->toISOString(),
        ];
    }

    private function formatInstallment(LeaseInstallment $i): array
    {
        return [
            'id'                => $i->id,
            'installmentNumber' => (int) $i->installment_number,
            'dueDate'           => $i->due_date?->toDateString(),
            'amount'            => (float) $i->amount,
            'paidAmount'        => $i->paid_amount !== null ? (float) $i->paid_amount : null,
            'paidDate'          => $i->paid_date?->toDateString(),
            'paymentMethod'     => $i->payment_method,
            'referenceNumber'   => $i->reference_number,
            'status'            => $i->status,
            'notes'             => $i->notes,
        ];
    }
}
