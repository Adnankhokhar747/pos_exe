<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SupplierPayment;
use App\Models\SupplierLedgerEntry;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;

class SupplierPaymentsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId    = $request->user()->tenant_id;
        $supplierIds = Supplier::where('tenant_id', $tenantId)->pluck('id');

        return SupplierPayment::whereIn('supplier_id', $supplierIds)
            ->with([
                'supplier',
                'purchaseOrder:id,order_no',
                'allocations.supplierInvoice:id,invoice_no,goods_receipt_id',
                'allocations.supplierInvoice.goodsReceipt:id,purchase_order_id',
                'allocations.supplierInvoice.goodsReceipt.purchaseOrder:id,order_no',
            ])
            ->when($request->supplierId, fn($q,$s) => $q->where('supplier_id',$s))
            ->orderByDesc('paid_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'supplierId' => 'required|uuid',
            'amount'     => 'required|numeric|min:0.01',
            'method'     => 'required|string',
        ]);

        $tenantId = $request->user()->tenant_id;
        $supplier = Supplier::where('tenant_id', $tenantId)->find($request->supplierId);
        if (!$supplier) throw new NotFoundException("Supplier {$request->supplierId} not found.");

        return DB::transaction(function () use ($request, $supplier) {
            $amount = (float) $request->amount;

            $payment = SupplierPayment::create([
                'id'          => (string) \Illuminate\Support\Str::uuid(),
                'supplier_id' => $supplier->id,
                'amount'      => $amount,
                'method'      => $request->method,
                'paid_at'     => now(),
            ]);

            $newBal = (float)$supplier->current_balance - $amount;
            $supplier->update(['current_balance' => $newBal]);

            SupplierLedgerEntry::create([
                'id'              => (string) \Illuminate\Support\Str::uuid(),
                'supplier_id'     => $supplier->id,
                'entry_type'      => 'payment',
                'amount'          => -$amount,
                'balance_after'   => $newBal,
                'reference_table' => 'supplier_payments',
                'reference_id'    => $payment->id,
                'occurred_at'     => now(),
            ]);

            return $payment->load('supplier');
        });
    }
}
