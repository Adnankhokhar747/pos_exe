<?php

namespace App\Http\Controllers\Lease;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\LeaseAgreement;
use App\Models\LeasePayment;
use Carbon\Carbon;

class LeaseAgreementsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $query    = LeaseAgreement::where('tenant_id', $tenantId)
            ->with(['property:id,name,type,address', 'customer:id,name,phone']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('propertyId')) {
            $query->where('property_id', $request->propertyId);
        }

        return response()->json(
            $query->orderByDesc('start_date')->get()->map(fn($a) => $this->format($a))
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'propertyId'    => 'required|uuid',
            'customerId'    => 'required|uuid',
            'startDate'     => 'required|date',
            'endDate'       => 'required|date|after:startDate',
            'rentAmount'    => 'required|numeric|min:0',
            'rentFrequency' => 'required|in:daily,weekly,monthly,yearly',
            'depositAmount' => 'nullable|numeric|min:0',
            'notes'         => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Verify property belongs to this tenant
        $property = \App\Models\LeaseProperty::where('id', $request->propertyId)
            ->where('tenant_id', $tenantId)
            ->firstOrFail();

        // Check property not already actively leased for overlapping dates
        $overlap = LeaseAgreement::where('property_id', $request->propertyId)
            ->whereIn('status', ['pending', 'active'])
            ->where(function ($q) use ($request) {
                $q->whereBetween('start_date', [$request->startDate, $request->endDate])
                  ->orWhereBetween('end_date', [$request->startDate, $request->endDate])
                  ->orWhere(function ($q2) use ($request) {
                      $q2->where('start_date', '<=', $request->startDate)
                         ->where('end_date', '>=', $request->endDate);
                  });
            })->exists();

        if ($overlap) {
            return response()->json([
                'error'   => 'overlap',
                'message' => 'This property already has an active lease overlapping the selected dates.',
            ], 422);
        }

        $agreement = LeaseAgreement::create([
            'id'             => (string) Str::uuid(),
            'tenant_id'      => $tenantId,
            'property_id'    => $request->propertyId,
            'customer_id'    => $request->customerId,
            'start_date'     => $request->startDate,
            'end_date'       => $request->endDate,
            'rent_amount'    => $request->rentAmount,
            'rent_frequency' => $request->rentFrequency,
            'deposit_amount' => $request->depositAmount ?? 0,
            'status'         => 'active',
            'notes'          => $request->notes,
            'created_by'     => $request->user()->id,
        ]);

        return response()->json($this->format($agreement->load(['property:id,name,type,address', 'customer:id,name,phone'])), 201);
    }

    public function show(Request $request, string $id)
    {
        $agreement = LeaseAgreement::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['property:id,name,type,address', 'customer:id,name,phone', 'payments'])
            ->firstOrFail();

        $data             = $this->format($agreement);
        $data['payments'] = $agreement->payments->map(fn($p) => $this->formatPayment($p))->values();

        return response()->json($data);
    }

    public function update(Request $request, string $id)
    {
        $agreement = LeaseAgreement::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $request->validate([
            'status'         => 'sometimes|in:pending,active,expired,terminated',
            'notes'          => 'nullable|string',
            'endDate'        => 'sometimes|date',
            'rentAmount'     => 'sometimes|numeric|min:0',
            'depositAmount'  => 'sometimes|numeric|min:0',
        ]);

        $data = [];
        if ($request->has('status'))        $data['status']         = $request->status;
        if ($request->has('notes'))         $data['notes']          = $request->notes;
        if ($request->has('endDate'))       $data['end_date']       = $request->endDate;
        if ($request->has('rentAmount'))    $data['rent_amount']    = $request->rentAmount;
        if ($request->has('depositAmount')) $data['deposit_amount'] = $request->depositAmount;

        $agreement->update($data);

        return response()->json($this->format($agreement->fresh()->load(['property:id,name,type,address', 'customer:id,name,phone'])));
    }

    public function recordPayment(Request $request, string $id)
    {
        $agreement = LeaseAgreement::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $request->validate([
            'amount'          => 'required|numeric|min:0.01',
            'paidDate'        => 'required|date',
            'periodStart'     => 'required|date',
            'periodEnd'       => 'required|date|after_or_equal:periodStart',
            'paymentMethod'   => 'nullable|string|max:50',
            'referenceNumber' => 'nullable|string|max:100',
            'notes'           => 'nullable|string',
        ]);

        $payment = LeasePayment::create([
            'id'               => (string) Str::uuid(),
            'tenant_id'        => $agreement->tenant_id,
            'lease_id'         => $agreement->id,
            'amount'           => $request->amount,
            'due_date'         => $request->periodEnd,
            'paid_date'        => $request->paidDate,
            'period_start'     => $request->periodStart,
            'period_end'       => $request->periodEnd,
            'payment_method'   => $request->paymentMethod,
            'status'           => 'paid',
            'reference_number' => $request->referenceNumber,
            'notes'            => $request->notes,
        ]);

        return response()->json($this->formatPayment($payment), 201);
    }

    public function payments(Request $request, string $id)
    {
        $agreement = LeaseAgreement::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $payments = LeasePayment::where('lease_id', $id)
            ->orderByDesc('paid_date')
            ->get()
            ->map(fn($p) => $this->formatPayment($p));

        return response()->json($payments);
    }

    private function format(LeaseAgreement $a): array
    {
        return [
            'id'            => $a->id,
            'propertyId'    => $a->property_id,
            'customerId'    => $a->customer_id,
            'property'      => $a->property ? [
                'id'      => $a->property->id,
                'name'    => $a->property->name,
                'type'    => $a->property->type,
                'address' => $a->property->address,
            ] : null,
            'customer'      => $a->customer ? [
                'id'    => $a->customer->id,
                'name'  => $a->customer->name,
                'phone' => $a->customer->phone,
            ] : null,
            'startDate'     => $a->start_date?->toDateString(),
            'endDate'       => $a->end_date?->toDateString(),
            'rentAmount'    => $a->rent_amount,
            'rentFrequency' => $a->rent_frequency,
            'depositAmount' => $a->deposit_amount,
            'status'        => $a->status,
            'notes'         => $a->notes,
            'createdAt'     => $a->created_at?->toISOString(),
        ];
    }

    private function formatPayment(LeasePayment $p): array
    {
        return [
            'id'              => $p->id,
            'leaseId'         => $p->lease_id,
            'amount'          => $p->amount,
            'dueDate'         => $p->due_date?->toDateString(),
            'paidDate'        => $p->paid_date?->toDateString(),
            'periodStart'     => $p->period_start?->toDateString(),
            'periodEnd'       => $p->period_end?->toDateString(),
            'paymentMethod'   => $p->payment_method,
            'status'          => $p->status,
            'referenceNumber' => $p->reference_number,
            'notes'           => $p->notes,
            'createdAt'       => $p->created_at?->toISOString(),
        ];
    }
}
