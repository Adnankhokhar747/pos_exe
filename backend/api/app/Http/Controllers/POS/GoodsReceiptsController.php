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
use App\Models\Supplier;
use App\Models\Branch;
use App\Models\Warehouse;
use App\Models\SupplierPayment;
use App\Models\SupplierPaymentAllocation;
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
                     ON DUPLICATE KEY UPDATE quantity_on_hand = quantity_on_hand + VALUES(quantity_on_hand)",
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

                $si = SupplierInvoice::create([
                    'id'               => (string) \Illuminate\Support\Str::uuid(),
                    'supplier_id'      => $supplierId,
                    'goods_receipt_id' => $gr->id,
                    'invoice_no'       => $siNo,
                    'amount'           => $totalCost,
                    'amount_paid'      => 0,
                    'status'           => 'unpaid',
                    'created_at'       => now(),
                ]);

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

                // Apply only advance payments made against this specific PO (not all supplier payments)
                // If no PO is linked, SI stays 'unpaid' — user pays manually
                if ($po) {
                    $remaining  = $totalCost;
                    $amountPaid = 0;
                    $poPayments = SupplierPayment::where('purchase_order_id', $po->id)
                        ->orderBy('paid_at')
                        ->get();
                    foreach ($poPayments as $pmnt) {
                        if ($remaining <= 0.001) break;
                        $alreadyAllocated = (float) SupplierPaymentAllocation
                            ::where('supplier_payment_id', $pmnt->id)
                            ->sum('amount_allocated');
                        $available = (float)$pmnt->amount - $alreadyAllocated;
                        if ($available <= 0.001) continue;
                        $allocate = min($available, $remaining);
                        SupplierPaymentAllocation::create([
                            'supplier_payment_id' => $pmnt->id,
                            'supplier_invoice_id' => $si->id,
                            'amount_allocated'    => $allocate,
                        ]);
                        $amountPaid += $allocate;
                        $remaining  -= $allocate;
                    }
                    if ($amountPaid > 0) {
                        $newSiStatus = $amountPaid >= $totalCost - 0.001 ? 'paid' : 'partially_paid';
                        $si->update(['amount_paid' => $amountPaid, 'status' => $newSiStatus]);
                    }
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
