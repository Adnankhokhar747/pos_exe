<?php

namespace App\Http\Controllers\Lab;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\LabOrder;
use App\Models\LabOrderItem;
use App\Models\LabResult;
use App\Models\LabTest;
use App\Models\Patient;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class LabOrdersController extends Controller
{
    public function index(Request $request)
    {
        return LabOrder::where('tenant_id', $request->user()->tenant_id)
            ->when($request->patientId,     fn($q, $v) => $q->where('patient_id', $v))
            ->when($request->status,        fn($q, $v) => $q->where('status', $v))
            ->when($request->priority,      fn($q, $v) => $q->where('priority', $v))
            ->when($request->doctorId,      fn($q, $v) => $q->where('doctor_id', $v))
            ->when($request->date,          fn($q, $v) => $q->whereDate('created_at', $v))
            ->with(['patient:id,name,phone', 'doctor:id,name'])
            ->withCount('items')
            ->orderByDesc('created_at')
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'patientId'     => 'required|uuid',
            'appointmentId' => 'nullable|uuid',
            'doctorId'      => 'nullable|uuid',
            'priority'      => 'in:routine,urgent,stat',
            'notes'         => 'nullable|string',
            'tests'         => 'required|array|min:1',
            'tests.*'       => 'uuid',
        ]);

        $tenantId = $request->user()->tenant_id;

        $patient = Patient::where('tenant_id', $tenantId)->find($request->patientId);
        if (!$patient) throw new NotFoundException('Patient not found.');

        $tests = LabTest::where('tenant_id', $tenantId)
            ->whereIn('id', $request->tests)
            ->where('is_active', true)
            ->get();

        if ($tests->count() !== count($request->tests)) {
            return response()->json(['error' => 'invalid_tests', 'message' => 'One or more tests not found or inactive.'], 422);
        }

        // Generate order number
        $count   = LabOrder::where('tenant_id', $tenantId)->count() + 1;
        $orderNo = 'LAB-' . str_pad($count, 4, '0', STR_PAD_LEFT);

        $total = $tests->sum('price');

        $order = LabOrder::create([
            'id'             => (string) Str::uuid(),
            'tenant_id'      => $tenantId,
            'order_number'   => $orderNo,
            'patient_id'     => $request->patientId,
            'appointment_id' => $request->appointmentId,
            'doctor_id'      => $request->doctorId,
            'ordered_by'     => $request->user()->id,
            'priority'       => $request->priority ?? 'routine',
            'total_amount'   => $total,
            'notes'          => $request->notes,
        ]);

        foreach ($tests as $test) {
            LabOrderItem::create([
                'id'           => (string) Str::uuid(),
                'order_id'     => $order->id,
                'test_id'      => $test->id,
                'test_code'    => $test->code,
                'test_name'    => $test->name,
                'unit'         => $test->unit,
                'normal_range' => $test->normal_range,
                'price'        => $test->price,
            ]);
        }

        return response()->json($order->load(['items', 'patient:id,name,phone', 'doctor:id,name']), 201);
    }

    public function show(Request $request, string $id)
    {
        $order = LabOrder::where('tenant_id', $request->user()->tenant_id)
            ->with(['patient:id,name,phone,gender,date_of_birth', 'doctor:id,name,specialization', 'items.result'])
            ->find($id);
        if (!$order) throw new NotFoundException("Lab order {$id} not found.");
        return $order;
    }

    public function collectSamples(Request $request, string $id)
    {
        $order = LabOrder::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$order) throw new NotFoundException("Lab order {$id} not found.");
        if ($order->status !== 'pending') throw new ConflictException('Only pending orders can have samples collected.');

        $order->update(['status' => 'sample_collected']);
        LabOrderItem::where('order_id', $id)->update([
            'status'       => 'sample_collected',
            'collected_at' => now(),
        ]);

        return $order->fresh(['items']);
    }

    public function cancel(Request $request, string $id)
    {
        $order = LabOrder::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$order) throw new NotFoundException("Lab order {$id} not found.");
        if ($order->status === 'completed') throw new ConflictException('Completed orders cannot be cancelled.');

        $order->update(['status' => 'cancelled']);
        return $order;
    }

    // ── Result entry ──────────────────────────────────────────────────────────

    public function enterResult(Request $request, string $itemId)
    {
        $item = LabOrderItem::find($itemId);
        if (!$item) throw new NotFoundException("Order item {$itemId} not found.");

        // Verify tenant
        $order = LabOrder::where('tenant_id', $request->user()->tenant_id)->find($item->order_id);
        if (!$order) throw new NotFoundException('Order not found or access denied.');

        $request->validate([
            'resultValue' => 'required|string|max:255',
            'resultFlag'  => 'required|in:normal,low,high,critical_low,critical_high,abnormal,pending',
            'remarks'     => 'nullable|string',
        ]);

        $result = LabResult::updateOrCreate(
            ['order_item_id' => $itemId],
            [
                'order_id'     => $item->order_id,
                'patient_id'   => $order->patient_id,
                'result_value' => $request->resultValue,
                'result_flag'  => $request->resultFlag,
                'remarks'      => $request->remarks,
                'entered_by'   => $request->user()->id,
            ]
        );

        $item->update(['status' => 'resulted', 'resulted_at' => now()]);

        // Auto-complete order if all items have results
        $pendingCount = LabOrderItem::where('order_id', $item->order_id)
            ->whereNotIn('status', ['resulted', 'verified'])
            ->count();

        if ($pendingCount === 0 && $order->status !== 'completed') {
            $order->update(['status' => 'completed']);
        } elseif ($order->status === 'pending' || $order->status === 'sample_collected') {
            $order->update(['status' => 'processing']);
        }

        return $result;
    }

    public function verifyResult(Request $request, string $itemId)
    {
        $item = LabOrderItem::find($itemId);
        if (!$item) throw new NotFoundException("Order item {$itemId} not found.");

        $order = LabOrder::where('tenant_id', $request->user()->tenant_id)->find($item->order_id);
        if (!$order) throw new NotFoundException('Access denied.');

        $result = LabResult::where('order_item_id', $itemId)->first();
        if (!$result) throw new ConflictException('Enter a result before verifying.');

        $result->update(['verified_by' => $request->user()->id]);
        $item->update(['status' => 'verified', 'verified_at' => now()]);

        return $result;
    }
}
