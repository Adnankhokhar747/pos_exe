<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\StockTransfer;
use App\Models\StockTransferLine;
use App\Models\StockLevel;
use App\Models\StockLedgerEntry;
use App\Models\Warehouse;
use App\Models\Branch;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class StockTransfersController extends Controller
{
    public function index(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        return StockTransfer::where(function($q) use ($warehouseIds) {
                $q->whereIn('from_warehouse_id', $warehouseIds)
                  ->orWhereIn('to_warehouse_id', $warehouseIds);
            })
            ->with(['lines.product'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'fromWarehouseId' => 'required|uuid',
            'toWarehouseId'   => 'required|uuid',
            'lines'           => 'required|array|min:1',
        ]);

        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        if (!$warehouseIds->contains($request->fromWarehouseId)) {
            throw new NotFoundException('From-warehouse not found.');
        }
        if (!$warehouseIds->contains($request->toWarehouseId)) {
            throw new NotFoundException('To-warehouse not found.');
        }

        return DB::transaction(function () use ($request) {
            $transfer = StockTransfer::create([
                'id'               => (string) \Illuminate\Support\Str::uuid(),
                'from_warehouse_id'=> $request->fromWarehouseId,
                'to_warehouse_id'  => $request->toWarehouseId,
                'status'           => 'draft',
                'created_at'       => now(),
            ]);

            foreach ($request->lines as $line) {
                StockTransferLine::create([
                    'id'               => (string) \Illuminate\Support\Str::uuid(),
                    'stock_transfer_id'=> $transfer->id,
                    'product_id'       => $line['productId'],
                    'quantity'         => $line['quantity'],
                ]);
            }

            return $transfer->load('lines.product');
        });
    }

    public function show(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        $transfer = StockTransfer::with(['lines.product'])
            ->where(function($q) use ($warehouseIds) {
                $q->whereIn('from_warehouse_id', $warehouseIds)
                  ->orWhereIn('to_warehouse_id', $warehouseIds);
            })
            ->find($id);
        if (!$transfer) throw new NotFoundException("Stock transfer {$id} not found.");
        return $transfer;
    }

    public function dispatch(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        $transfer = StockTransfer::with('lines')
            ->where(function($q) use ($warehouseIds) {
                $q->whereIn('from_warehouse_id', $warehouseIds);
            })
            ->find($id);
        if (!$transfer) throw new NotFoundException("Stock transfer {$id} not found.");
        if ($transfer->status !== 'draft') throw new ConflictException('Transfer already dispatched.');

        return DB::transaction(function () use ($transfer) {
            foreach ($transfer->lines as $line) {
                DB::statement(
                    "INSERT INTO stock_levels (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
                     VALUES (?, ?, 0, 0)
                     ON DUPLICATE KEY UPDATE quantity_on_hand = GREATEST(0, quantity_on_hand - ?)",
                    [$transfer->from_warehouse_id, $line->product_id, $line->quantity]
                );

                StockLedgerEntry::create([
                    'id'                   => (string) \Illuminate\Support\Str::uuid(),
                    'warehouse_id'         => $transfer->from_warehouse_id,
                    'product_id'           => $line->product_id,
                    'movement_type'        => 'transfer_out',
                    'quantity_delta'       => -(float)$line->quantity,
                    'unit_cost_at_movement'=> 0,
                    'reference_table'      => 'stock_transfers',
                    'reference_id'         => $transfer->id,
                    'occurred_at'          => now(),
                ]);
            }

            $transfer->update(['status' => 'dispatched']);
            return $transfer->fresh(['lines.product']);
        });
    }

    public function receive(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        $transfer = StockTransfer::with('lines')
            ->where(function($q) use ($warehouseIds) {
                $q->whereIn('to_warehouse_id', $warehouseIds);
            })
            ->find($id);
        if (!$transfer) throw new NotFoundException("Stock transfer {$id} not found.");
        if ($transfer->status !== 'dispatched') throw new ConflictException('Transfer must be dispatched before receiving.');

        return DB::transaction(function () use ($transfer) {
            foreach ($transfer->lines as $line) {
                DB::statement(
                    "INSERT INTO stock_levels (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
                     VALUES (?, ?, ?, 0)
                     ON DUPLICATE KEY UPDATE quantity_on_hand = quantity_on_hand + VALUES(quantity_on_hand)",
                    [$transfer->to_warehouse_id, $line->product_id, $line->quantity]
                );

                StockLedgerEntry::create([
                    'id'                   => (string) \Illuminate\Support\Str::uuid(),
                    'warehouse_id'         => $transfer->to_warehouse_id,
                    'product_id'           => $line->product_id,
                    'movement_type'        => 'transfer_in',
                    'quantity_delta'       => (float)$line->quantity,
                    'unit_cost_at_movement'=> 0,
                    'reference_table'      => 'stock_transfers',
                    'reference_id'         => $transfer->id,
                    'occurred_at'          => now(),
                ]);
            }

            $transfer->update(['status' => 'received']);
            return $transfer->fresh(['lines.product']);
        });
    }
}
