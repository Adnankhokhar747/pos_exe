<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\RestaurantOrder;
use App\Models\RestaurantOrderItem;
use App\Models\RestaurantKdsTicket;
use App\Models\RestaurantSplitBill;
use App\Models\RestaurantSplitBillParty;
use App\Models\Product;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class RestaurantOrdersController extends Controller
{
    // ── Orders ────────────────────────────────────────────────────────────────

    public function show(Request $request, string $orderId)
    {
        $order = RestaurantOrder::where('tenant_id', $request->user()->tenant_id)
            ->with(['items', 'tickets'])
            ->find($orderId);
        if (!$order) throw new NotFoundException("Order {$orderId} not found.");
        return $order;
    }

    // ── Order Items ───────────────────────────────────────────────────────────

    public function addItem(Request $request, string $orderId)
    {
        $request->validate([
            'productId'   => 'nullable|uuid',
            'productName' => 'required|string|max:255',
            'quantity'    => 'required|numeric|min:0.001',
            'unitPrice'   => 'required|numeric|min:0',
            'notes'       => 'nullable|string',
        ]);

        $order = RestaurantOrder::where('tenant_id', $request->user()->tenant_id)->find($orderId);
        if (!$order) throw new NotFoundException("Order {$orderId} not found.");
        if ($order->status !== 'open') throw new ConflictException('Order is not open.');

        $qty      = $request->quantity;
        $price    = $request->unitPrice;
        $subtotal = round($qty * $price, 4);

        $item = RestaurantOrderItem::create([
            'id'           => (string) Str::uuid(),
            'order_id'     => $orderId,
            'product_id'   => $request->productId,
            'product_name' => $request->productName,
            'quantity'     => $qty,
            'unit_price'   => $price,
            'subtotal'     => $subtotal,
            'notes'        => $request->notes,
        ]);

        return response()->json($item, 201);
    }

    public function updateItem(Request $request, string $itemId)
    {
        $item = RestaurantOrderItem::whereHas('order', function ($q) use ($request) {
            $q->where('tenant_id', $request->user()->tenant_id);
        })->find($itemId);
        if (!$item) throw new NotFoundException("Item {$itemId} not found.");

        $request->validate([
            'quantity'  => 'sometimes|numeric|min:0.001',
            'unitPrice' => 'sometimes|numeric|min:0',
            'notes'     => 'nullable|string',
        ]);

        $qty   = $request->quantity ?? $item->quantity;
        $price = $request->unitPrice ?? $item->unit_price;

        $item->update([
            'quantity'   => $qty,
            'unit_price' => $price,
            'subtotal'   => round($qty * $price, 4),
            'notes'      => $request->notes ?? $item->notes,
        ]);

        return $item;
    }

    public function removeItem(Request $request, string $itemId)
    {
        $item = RestaurantOrderItem::whereHas('order', function ($q) use ($request) {
            $q->where('tenant_id', $request->user()->tenant_id);
        })->find($itemId);
        if (!$item) throw new NotFoundException("Item {$itemId} not found.");
        if ($item->kds_ticket_id) throw new ConflictException('Cannot remove an item already sent to the kitchen.');

        $item->delete();
        return response()->json(['message' => 'Item removed.']);
    }

    // ── Send to Kitchen ───────────────────────────────────────────────────────

    public function sendToKitchen(Request $request, string $orderId)
    {
        $order = RestaurantOrder::where('tenant_id', $request->user()->tenant_id)
            ->with('items')
            ->find($orderId);
        if (!$order) throw new NotFoundException("Order {$orderId} not found.");
        if ($order->status !== 'open') throw new ConflictException('Order is not open.');

        $unsent = $order->items->whereNull('kds_ticket_id')->where('kds_status', 'pending');
        if ($unsent->isEmpty()) throw new ConflictException('No new items to send to the kitchen.');

        $ticket = RestaurantKdsTicket::create([
            'id'        => (string) Str::uuid(),
            'tenant_id' => $request->user()->tenant_id,
            'order_id'  => $orderId,
        ]);

        foreach ($unsent as $item) {
            $item->update(['kds_ticket_id' => $ticket->id]);
        }

        return response()->json($ticket->load('items'), 201);
    }

    // ── Split Bills ───────────────────────────────────────────────────────────

    public function createSplitBill(Request $request)
    {
        $request->validate([
            'sessionId'   => 'required|uuid',
            'splitCount'  => 'required|integer|min:2|max:20',
            'totalAmount' => 'required|numeric|min:0.01',
        ]);

        $tenantId = $request->user()->tenant_id;

        $exists = RestaurantSplitBill::where('session_id', $request->sessionId)
            ->where('status', 'pending')
            ->exists();
        if ($exists) throw new ConflictException('An active split bill already exists for this session.');

        $total  = $request->totalAmount;
        $count  = $request->splitCount;
        $share  = round($total / $count, 4);

        $split = RestaurantSplitBill::create([
            'id'           => (string) Str::uuid(),
            'tenant_id'    => $tenantId,
            'session_id'   => $request->sessionId,
            'split_count'  => $count,
            'total_amount' => $total,
        ]);

        $parties = [];
        for ($i = 1; $i <= $count; $i++) {
            $amount = ($i === $count) ? round($total - $share * ($count - 1), 4) : $share;
            $parties[] = RestaurantSplitBillParty::create([
                'id'            => (string) Str::uuid(),
                'split_bill_id' => $split->id,
                'party_number'  => $i,
                'amount'        => $amount,
            ]);
        }

        return response()->json($split->load('parties'), 201);
    }

    public function showSplitBill(Request $request, string $splitId)
    {
        $split = RestaurantSplitBill::where('tenant_id', $request->user()->tenant_id)
            ->with('parties')
            ->find($splitId);
        if (!$split) throw new NotFoundException("Split bill {$splitId} not found.");
        return $split;
    }

    public function payParty(Request $request, string $splitId, string $partyId)
    {
        $split = RestaurantSplitBill::where('tenant_id', $request->user()->tenant_id)
            ->with('parties')
            ->find($splitId);
        if (!$split) throw new NotFoundException("Split bill {$splitId} not found.");

        $party = $split->parties->find($partyId);
        if (!$party) throw new NotFoundException("Party {$partyId} not found.");
        if ($party->is_paid) throw new ConflictException('This party has already paid.');

        $party->update([
            'is_paid'    => true,
            'invoice_id' => $request->invoiceId,
            'paid_at'    => now(),
        ]);

        // Check if all parties paid
        $split->refresh()->load('parties');
        if ($split->parties->every(fn($p) => $p->is_paid)) {
            $split->update(['status' => 'completed']);
        }

        return $split->load('parties');
    }
}
