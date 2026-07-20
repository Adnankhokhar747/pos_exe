<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\RestaurantKdsTicket;
use App\Models\RestaurantOrderItem;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class RestaurantKdsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        return RestaurantKdsTicket::where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->with([
                'items',
                'order.session.table',
            ])
            ->orderBy('sent_at', 'asc')
            ->get()
            ->map(function ($ticket) {
                $ticket->table_number = $ticket->order->session->table->table_number ?? null;
                $ticket->table_label  = $ticket->order->session->table->label ?? null;
                $ticket->covers       = $ticket->order->session->covers ?? null;
                return $ticket;
            });
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate(['status' => 'required|in:pending,preparing,ready,done']);

        $ticket = RestaurantKdsTicket::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$ticket) throw new NotFoundException("KDS ticket {$id} not found.");

        $transitions = [
            'pending'   => ['preparing'],
            'preparing' => ['ready'],
            'ready'     => ['done'],
            'done'      => [],
        ];

        if (!in_array($request->status, $transitions[$ticket->status])) {
            throw new ConflictException("Cannot transition from '{$ticket->status}' to '{$request->status}'.");
        }

        $updates = ['status' => $request->status];
        if ($request->status === 'preparing') $updates['started_at']   = now();
        if ($request->status === 'done')      $updates['completed_at'] = now();

        $ticket->update($updates);

        // Keep item kds_status in sync
        $kdsItemStatus = [
            'preparing' => 'preparing',
            'ready'     => 'ready',
            'done'      => 'served',
        ];
        if (isset($kdsItemStatus[$request->status])) {
            RestaurantOrderItem::where('kds_ticket_id', $id)
                ->update(['kds_status' => $kdsItemStatus[$request->status]]);
        }

        return $ticket->load('items');
    }
}
