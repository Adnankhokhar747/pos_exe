<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptLine;
use App\Models\PurchaseOrder;
use App\Models\StockLevel;
use App\Models\StockLedgerEntry;
use App\Models\SupplierInvoice;
use App\Models\SupplierLedgerEntry;
use App\Models\SupplierPayment;
use App\Models\SupplierPaymentAllocation;
use App\Models\Supplier;
use App\Models\Branch;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class GoodsReceiptsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        return GoodsReceipt::whereIn('warehouse_id', $warehouseIds)
            ->with(['lines', 'purchaseOrder:id,order_no'])
            ->when($request->warehouseId, fn($q,$w) => $q->where('warehouse_id',$w))
            ->when($request->purchaseOrderId, fn($q,$p) => $q->where('purchase_order_id',$p))
            ->orderByDesc('received_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'warehouseId' => 'required|uuid',
            'lines'       => 'required|array|min:1',
        ]);

        return DB::transaction(function () use ($request) {
            $tenantId    = $request->user()->tenant_id;
            $warehouseId = $request->warehouseId;

            // Validate PO if linked
            $po = null;
            if ($request->purchaseOrderId) {
                $po = PurchaseOrder::where('tenant_id', $tenantId)->find($request->purchaseOrderId);
                if (!$po) throw new NotFoundException("Purchase order {$request->purchaseOrderId} not found.");
                if ($po->status === 'received') throw new ConflictException('Purchase order already fully received.');
            }

            $count     = GoodsReceipt::where('warehouse_id', $warehouseId)->count();
            $receiptNo = 'GR-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

            $gr = GoodsReceipt::create([
                'id'               => (string) \Illuminate\Support\Str::uuid(),
                'purchase_order_id'=> $po?->id,
                'warehouse_id'     => $warehouseId,
                'receipt_no'       => $receiptNo,
                'status'           => 'posted',
                'received_at'      => now(),
            ]);

            $totalCost = 0;
            foreach ($request->lines as $line) {
                $qty      = (float) $line['quantityReceived'];
                $cost     = (float) $line['unitCost'];
                $prodId   = $line['productId'];

                GoodsReceiptLine::create([
                    'id'               => (string) \Illuminate\Support\Str::uuid(),
                    'goods_receipt_id' => $gr->id,
                    'product_id'       => $prodId,
                    'quantity_received' => $qty,
                    'unit_cost'        => $cost,
                    'batch_no'         => $line['batchNo'] ?? null,
                    'expiry_date'      => $line['expiryDate'] ?? null,
                ]);

                DB::statement(
                    "INSERT INTO stock_levels (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
                     VALUES (?, ?, ?, 0)
                     ON CONFLICT (warehouse_id, product_id)
                     DO UPDATE SET quantity_on_hand = stock_levels.quantity_on_hand + EXCLUDED.quantity_on_hand",
                    [$warehouseId, $prodId, $qty]
                );

                // Update PO line received quantity if linked to a PO
                if ($po) {
                    \App\Models\PurchaseOrderLine::where('purchase_order_id', $po->id)
                        ->where('product_id', $prodId)
                        ->increment('quantity_received', $qty);
                }

                StockLedgerEntry::create([
                    'id'                    => (string) \Illuminate\Support\Str::uuid(),
                    'warehouse_id'          => $warehouseId,
                    'product_id'            => $prodId,
                    'movement_type'         => 'purchase_receipt',
                    'quantity_delta'        => $qty,
                    'unit_cost_at_movement' => $cost,
                    'reference_table'       => 'goods_receipts',
                    'reference_id'          => $gr->id,
                    'occurred_at'           => now(),
                ]);

                $totalCost += $qty * $cost;
            }

            // Create supplier invoice (from PO supplier or skip if no PO and no supplier provided)
            $supplierId = $po?->supplier_id ?? $request->supplierId ?? null;
            if ($supplierId) {
                $supplier  = Supplier::find($supplierId);
                $invCount  = SupplierInvoice::where('supplier_id', $supplierId)->count();
                $siNo      = 'SI-' . str_pad($invCount + 1, 5, '0', STR_PAD_LEFT);

                // Auto-apply any advance payments made against the linked PO
                $advancePaid = $po ? (float) SupplierPayment::where('purchase_order_id', $po->id)->sum('amount') : 0;
                $amountPaid  = min($advancePaid, $totalCost);
                $invStatus   = $amountPaid >= $totalCost ? 'paid' : ($amountPaid > 0 ? 'partially_paid' : 'unpaid');

                $si = SupplierInvoice::create([
                    'id'               => (string) \Illuminate\Support\Str::uuid(),
                    'supplier_id'      => $supplierId,
                    'goods_receipt_id' => $gr->id,
                    'invoice_no'       => $siNo,
                    'amount'           => $totalCost,
                    'amount_paid'      => $amountPaid,
                    'status'           => $invStatus,
                    'created_at'       => now(),
                ]);

                // Link advance payments → new invoice via allocations so both PO + invoice refs appear on payment rows
                if ($po && $amountPaid > 0) {
                    $remaining       = $amountPaid;
                    $advancePayments = SupplierPayment::where('purchase_order_id', $po->id)->get();
                    foreach ($advancePayments as $advPayment) {
                        if ($remaining <= 0) break;
                        $allocated = min((float) $advPayment->amount, $remaining);
                        SupplierPaymentAllocation::firstOrCreate(
                            ['supplier_payment_id' => $advPayment->id, 'supplier_invoice_id' => $si->id],
                            ['amount_allocated' => $allocated]
                        );
                        $remaining -= $allocated;
                    }
                }

                if ($supplier) {
                    $newBal = (float)$supplier->current_balance + $totalCost;
                    $supplier->update(['current_balance' => $newBal]);
                    SupplierLedgerEntry::create([
                        'id'              => (string) \Illuminate\Support\Str::uuid(),
                        'supplier_id'     => $supplierId,
                        'entry_type'      => 'purchase_invoice',
                        'amount'          => $totalCost,
                        'balance_after'   => $newBal,
                        'reference_table' => 'supplier_invoices',
                        'reference_id'    => $si->id,
                        'occurred_at'     => now(),
                    ]);
                }
            }

            // Mark PO as received
            if ($po) {
                $po->update(['status' => 'received']);
            }

            return $gr->load(['lines', 'purchaseOrder:id,order_no']);
        });
    }

    public function show(Request $request, string $id)
    {
        $tenantId     = $request->user()->tenant_id;
        $branchIds    = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        $gr = GoodsReceipt::with(['lines', 'purchaseOrder:id,order_no'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->find($id);
        if (!$gr) throw new NotFoundException("Goods receipt {$id} not found.");
        return $gr;
    }
}
