<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptLine;
use App\Models\StockLedgerEntry;
use App\Models\SupplierInvoice;
use App\Models\SupplierLedgerEntry;
use App\Models\SupplierPayment;
use App\Models\SupplierPaymentAllocation;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class PurchaseOrdersController extends Controller
{
    public function index(Request $request)
    {
        return PurchaseOrder::where('tenant_id', $request->user()->tenant_id)
            ->with(['supplier', 'lines.product', 'goodsReceipts.supplierInvoices'])
            ->withSum('payments', 'amount')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'supplierId'  => 'required|uuid',
            'warehouseId' => 'required|uuid',
            'lines'       => 'required|array|min:1',
        ]);

        return DB::transaction(function () use ($request) {
            $tenantId = $request->user()->tenant_id;
            $count = PurchaseOrder::where('tenant_id', $tenantId)->count();
            $orderNo = 'PO-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

            $po = PurchaseOrder::create([
                'id'          => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'   => $tenantId,
                'supplier_id' => $request->supplierId,
                'warehouse_id'=> $request->warehouseId,
                'order_no'    => $orderNo,
                'status'      => 'draft',
            ]);

            foreach ($request->lines as $line) {
                PurchaseOrderLine::create([
                    'id'               => (string) \Illuminate\Support\Str::uuid(),
                    'purchase_order_id'=> $po->id,
                    'product_id'       => $line['productId'],
                    'quantity_ordered'  => $line['quantityOrdered'],
                    'unit_cost'        => $line['unitCost'],
                ]);
            }

            return $po->loadSum('payments', 'amount')->load(['supplier','lines.product']);
        });
    }

    public function show(Request $request, string $id)
    {
        $po = PurchaseOrder::with(['supplier','lines.product','goodsReceipts.lines'])
            ->withSum('payments', 'amount')
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$po) throw new NotFoundException("Purchase order {$id} not found.");
        return $po;
    }

    public function send(Request $request, string $id)
    {
        $po = PurchaseOrder::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$po) throw new NotFoundException("Purchase order {$id} not found.");
        if ($po->status !== 'draft') throw new ConflictException("Purchase order is already {$po->status}.");

        $po->update(['status' => 'sent']);
        return $po->loadSum('payments', 'amount')->load(['supplier', 'lines.product']);
    }

    public function pay(Request $request, string $id)
    {
        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string',
        ]);

        $po = PurchaseOrder::with('supplier')
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$po) throw new NotFoundException("Purchase order {$id} not found.");
        if ($po->status === 'voided') throw new ConflictException('Cannot pay against a voided purchase order.');

        return DB::transaction(function () use ($request, $po) {
            $amount   = (float) $request->amount;
            $supplier = Supplier::find($po->supplier_id);

            $payment = SupplierPayment::create([
                'id'                => (string) \Illuminate\Support\Str::uuid(),
                'supplier_id'       => $po->supplier_id,
                'purchase_order_id' => $po->id,
                'amount'            => $amount,
                'method'            => $request->method,
                'paid_at'           => now(),
            ]);

            if ($supplier) {
                $newBal = (float)$supplier->current_balance - $amount;
                $supplier->update(['current_balance' => $newBal]);
                SupplierLedgerEntry::create([
                    'id'              => (string) \Illuminate\Support\Str::uuid(),
                    'supplier_id'     => $po->supplier_id,
                    'entry_type'      => 'advance_payment',
                    'amount'          => -$amount,
                    'balance_after'   => $newBal,
                    'reference_table' => 'supplier_payments',
                    'reference_id'    => $payment->id,
                    'occurred_at'     => now(),
                ]);
            }

            return $po->fresh()->loadSum('payments', 'amount')->load(['supplier', 'lines.product']);
        });
    }

    public function receiveGoods(Request $request, string $id)
    {
        $request->validate(['lines' => 'required|array|min:1']);

        $po = PurchaseOrder::with('lines')
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$po) throw new NotFoundException("Purchase order {$id} not found.");
        if ($po->status === 'received') throw new ConflictException('Purchase order already fully received.');

        return DB::transaction(function () use ($request, $po) {
            $count = GoodsReceipt::where('warehouse_id', $po->warehouse_id)->count();
            $receiptNo = 'GR-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

            $gr = GoodsReceipt::create([
                'id'               => (string) \Illuminate\Support\Str::uuid(),
                'purchase_order_id'=> $po->id,
                'warehouse_id'     => $po->warehouse_id,
                'receipt_no'       => $receiptNo,
                'status'           => 'posted',
            ]);

            $totalCost = 0;
            foreach ($request->lines as $line) {
                GoodsReceiptLine::create([
                    'id'              => (string) \Illuminate\Support\Str::uuid(),
                    'goods_receipt_id'=> $gr->id,
                    'product_id'      => $line['productId'],
                    'quantity_received'=> $line['quantityReceived'],
                    'unit_cost'       => $line['unitCost'],
                    'batch_no'        => $line['batchNo'] ?? null,
                    'expiry_date'     => $line['expiryDate'] ?? null,
                ]);

                PurchaseOrderLine::where('purchase_order_id', $po->id)
                    ->where('product_id', $line['productId'])
                    ->increment('quantity_received', $line['quantityReceived']);

                DB::statement(
                    "INSERT INTO stock_levels (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
                     VALUES (?, ?, ?, 0)
                     ON CONFLICT (warehouse_id, product_id)
                     DO UPDATE SET quantity_on_hand = stock_levels.quantity_on_hand + EXCLUDED.quantity_on_hand",
                    [$po->warehouse_id, $line['productId'], $line['quantityReceived']]
                );

                StockLedgerEntry::create([
                    'id'              => (string) \Illuminate\Support\Str::uuid(),
                    'warehouse_id'    => $po->warehouse_id,
                    'product_id'      => $line['productId'],
                    'movement_type'   => 'purchase_receipt',
                    'quantity_delta'  => $line['quantityReceived'],
                    'unit_cost_at_movement' => $line['unitCost'],
                    'reference_table' => 'goods_receipts',
                    'reference_id'    => $gr->id,
                ]);

                $totalCost += $line['quantityReceived'] * $line['unitCost'];
            }

            // Auto-apply any advance payments made against this PO
            $advancePaid = (float) SupplierPayment::where('purchase_order_id', $po->id)->sum('amount');
            $amountPaid  = min($advancePaid, $totalCost);
            $status      = $amountPaid >= $totalCost ? 'paid' : ($amountPaid > 0 ? 'partially_paid' : 'unpaid');

            $supplier  = Supplier::find($po->supplier_id);
            $invCount  = SupplierInvoice::where('supplier_id', $po->supplier_id)->count();
            $siNo      = 'SI-' . str_pad($invCount + 1, 5, '0', STR_PAD_LEFT);

            $si = SupplierInvoice::create([
                'id'              => (string) \Illuminate\Support\Str::uuid(),
                'supplier_id'     => $po->supplier_id,
                'goods_receipt_id'=> $gr->id,
                'invoice_no'      => $siNo,
                'amount'          => $totalCost,
                'amount_paid'     => $amountPaid,
                'status'          => $status,
            ]);

            // Link advance payments → invoice so both PO + invoice refs appear on payment rows
            if ($amountPaid > 0) {
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
                    'id'             => (string) \Illuminate\Support\Str::uuid(),
                    'supplier_id'    => $po->supplier_id,
                    'entry_type'     => 'purchase_invoice',
                    'amount'         => $totalCost,
                    'balance_after'  => $newBal,
                    'reference_table'=> 'supplier_invoices',
                    'reference_id'   => $si->id,
                ]);
            }

            $po->update(['status' => 'received']);

            return $gr->load('lines.product');
        });
    }
}
