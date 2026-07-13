<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\StockAdjustment;
use App\Models\StockAdjustmentLine;
use App\Models\StockLevel;
use App\Models\StockLedgerEntry;
use App\Models\Warehouse;
use App\Models\Branch;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class StockAdjustmentsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        return StockAdjustment::whereIn('warehouse_id', $warehouseIds)
            ->with(['lines.product'])
            ->when($request->warehouseId, fn($q,$w) => $q->where('warehouse_id',$w))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'warehouseId' => 'required|uuid',
            'reasonCode'  => 'required|string',
            'lines'       => 'required|array|min:1',
        ]);

        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouse = Warehouse::whereIn('branch_id', $branchIds)->find($request->warehouseId);
        if (!$warehouse) throw new NotFoundException('Warehouse not found or does not belong to your tenant.');

        return DB::transaction(function () use ($request, $warehouse) {
            $adj = StockAdjustment::create([
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'warehouse_id' => $warehouse->id,
                'reason_code'  => $request->reasonCode,
                'note'         => $request->note,
                'status'       => 'posted',
                'created_at'   => now(),
            ]);

            foreach ($request->lines as $line) {
                $systemQty  = (float) (StockLevel::where('warehouse_id', $warehouse->id)
                    ->where('product_id', $line['productId'])
                    ->value('quantity_on_hand') ?? 0);
                $countedQty = (float) $line['countedQuantity'];
                $delta      = $countedQty - $systemQty;

                StockAdjustmentLine::create([
                    'id'                 => (string) \Illuminate\Support\Str::uuid(),
                    'stock_adjustment_id'=> $adj->id,
                    'product_id'         => $line['productId'],
                    'counted_quantity'   => $countedQty,
                    'system_quantity'    => $systemQty,
                ]);

                // Update stock level (SET to counted qty, not increment)
                DB::statement(
                    "INSERT INTO stock_levels (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
                     VALUES (?, ?, ?, 0)
                     ON CONFLICT (warehouse_id, product_id)
                     DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand",
                    [$warehouse->id, $line['productId'], $countedQty]
                );

                if ($delta != 0) {
                    StockLedgerEntry::create([
                        'id'                   => (string) \Illuminate\Support\Str::uuid(),
                        'warehouse_id'         => $warehouse->id,
                        'product_id'           => $line['productId'],
                        'movement_type'        => 'adjustment',
                        'quantity_delta'       => $delta,
                        'unit_cost_at_movement'=> 0,
                        'reference_table'      => 'stock_adjustments',
                        'reference_id'         => $adj->id,
                        'occurred_at'          => now(),
                    ]);
                }
            }

            return $adj->load('lines.product');
        });
    }

    public function show(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        $adj = StockAdjustment::with(['lines.product'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->find($id);
        if (!$adj) throw new NotFoundException("Stock adjustment {$id} not found.");
        return $adj;
    }
}
