<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\RestaurantTable;
use App\Models\RestaurantTableSession;
use App\Models\RestaurantOrder;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class RestaurantTablesController extends Controller
{
    // ── Tables ────────────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        return RestaurantTable::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->when($request->branchId, fn($q, $b) => $q->where('branch_id', $b))
            ->when($request->section, fn($q, $s) => $q->where('section', $s))
            ->with('activeSession.order.items')
            ->orderBy('section')
            ->orderBy('table_number')
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'tableNumber' => 'required|string|max:20',
            'capacity'    => 'required|integer|min:1|max:50',
            'label'       => 'nullable|string|max:100',
            'section'     => 'nullable|string|max:50',
            'branchId'    => 'nullable|uuid',
            'notes'       => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        $exists = RestaurantTable::where('tenant_id', $tenantId)
            ->where('branch_id', $request->branchId)
            ->where('table_number', $request->tableNumber)
            ->exists();
        if ($exists) {
            throw new ConflictException("Table number '{$request->tableNumber}' already exists.");
        }

        return response()->json(
            RestaurantTable::create([
                'id'           => (string) Str::uuid(),
                'tenant_id'    => $tenantId,
                'branch_id'    => $request->branchId,
                'table_number' => $request->tableNumber,
                'label'        => $request->label,
                'capacity'     => $request->capacity,
                'section'      => $request->section,
                'notes'        => $request->notes,
            ]),
            201
        );
    }

    public function show(Request $request, string $id)
    {
        $table = RestaurantTable::where('tenant_id', $request->user()->tenant_id)
            ->with('activeSession.order.items')
            ->find($id);
        if (!$table) throw new NotFoundException("Table {$id} not found.");
        return $table;
    }

    public function update(Request $request, string $id)
    {
        $table = RestaurantTable::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$table) throw new NotFoundException("Table {$id} not found.");

        $request->validate([
            'tableNumber' => 'sometimes|string|max:20',
            'label'       => 'nullable|string|max:100',
            'capacity'    => 'sometimes|integer|min:1|max:50',
            'section'     => 'nullable|string|max:50',
            'notes'       => 'nullable|string',
        ]);

        $table->update(array_filter([
            'table_number' => $request->tableNumber,
            'label'        => $request->label,
            'capacity'     => $request->capacity,
            'section'      => $request->section,
            'notes'        => $request->notes,
        ], fn($v) => $v !== null));

        return $table;
    }

    public function destroy(Request $request, string $id)
    {
        $table = RestaurantTable::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$table) throw new NotFoundException("Table {$id} not found.");
        if ($table->status === 'occupied') throw new ConflictException('Cannot delete an occupied table.');

        $table->update(['is_active' => false]);
        return response()->json(['message' => 'Table deactivated.']);
    }

    public function setStatus(Request $request, string $id)
    {
        $request->validate(['status' => 'required|in:available,reserved,cleaning']);

        $table = RestaurantTable::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$table) throw new NotFoundException("Table {$id} not found.");
        if ($table->status === 'occupied') throw new ConflictException('Cannot change status of an occupied table. Close the session first.');

        $table->update(['status' => $request->status]);
        return $table;
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    public function openSession(Request $request, string $tableId)
    {
        $request->validate([
            'covers'     => 'required|integer|min:1',
            'waiterName' => 'nullable|string|max:100',
            'notes'      => 'nullable|string',
        ]);

        $table = RestaurantTable::where('tenant_id', $request->user()->tenant_id)->find($tableId);
        if (!$table) throw new NotFoundException("Table {$tableId} not found.");
        if ($table->status === 'occupied') throw new ConflictException('Table already has an open session.');
        if (!$table->is_active) throw new ConflictException('Table is not active.');

        $session = RestaurantTableSession::create([
            'id'          => (string) Str::uuid(),
            'tenant_id'   => $request->user()->tenant_id,
            'table_id'    => $tableId,
            'opened_by'   => $request->user()->id,
            'covers'      => $request->covers,
            'waiter_name' => $request->waiterName,
            'notes'       => $request->notes,
        ]);

        // Create the running order for this session immediately
        $order = RestaurantOrder::create([
            'id'         => (string) Str::uuid(),
            'tenant_id'  => $request->user()->tenant_id,
            'session_id' => $session->id,
            'created_by' => $request->user()->id,
        ]);

        $table->update(['status' => 'occupied']);

        return response()->json($session->load(['order']), 201);
    }

    public function showSession(Request $request, string $sessionId)
    {
        $session = RestaurantTableSession::where('tenant_id', $request->user()->tenant_id)
            ->with(['table', 'order.items', 'order.tickets'])
            ->find($sessionId);
        if (!$session) throw new NotFoundException("Session {$sessionId} not found.");
        return $session;
    }

    public function closeSession(Request $request, string $sessionId)
    {
        $session = RestaurantTableSession::where('tenant_id', $request->user()->tenant_id)
            ->with('table', 'order')
            ->find($sessionId);
        if (!$session) throw new NotFoundException("Session {$sessionId} not found.");
        if ($session->closed_at) throw new ConflictException('Session is already closed.');

        $session->update([
            'closed_at'  => now(),
            'invoice_id' => $request->invoiceId,
        ]);

        if ($session->order) {
            $session->order->update(['status' => 'closed']);
        }

        if ($session->table) {
            $session->table->update(['status' => 'available']);
        }

        return $session->refresh()->load('table');
    }
}
