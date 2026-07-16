<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Models\SupplierPaymentAllocation;
use App\Models\SupplierLedgerEntry;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class SupplierInvoicesController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $supplierIds = Supplier::where('tenant_id', $tenantId)->pluck('id');

        return SupplierInvoice::whereIn('supplier_id', $supplierIds)
            ->with(['supplier', 'goodsReceipt:id,receipt_no,purchase_order_id', 'goodsReceipt.purchaseOrder:id,order_no'])
            ->when($request->supplierId, fn($q,$s) => $q->where('supplier_id',$s))
            ->when($request->status, fn($q,$s) => $q->where('status',$s))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'supplierId' => 'required|uuid',
            'invoiceNo'  => 'required|string',
            'amount'     => 'required|numeric|min:0.01',
        ]);

        $tenantId    = $request->user()->tenant_id;
        $supplierIds = Supplier::where('tenant_id', $tenantId)->pluck('id');

        if (!$supplierIds->contains($request->supplierId)) {
            throw new NotFoundException("Supplier {$request->supplierId} not found.");
        }

        $inv = SupplierInvoice::create([
            'id'          => (string) \Illuminate\Support\Str::uuid(),
            'supplier_id' => $request->supplierId,
            'invoice_no'  => $request->invoiceNo,
            'amount'      => $request->amount,
            'amount_paid' => 0,
            'due_date'    => $request->dueDate ?? null,
            'status'      => 'unpaid',
            'created_at'  => now(),
        ]);

        $supplier = Supplier::find($request->supplierId);
        if ($supplier) {
            $newBal = (float)$supplier->current_balance + (float)$request->amount;
            $supplier->update(['current_balance' => $newBal]);
            SupplierLedgerEntry::create([
                'id'              => (string) \Illuminate\Support\Str::uuid(),
                'supplier_id'     => $request->supplierId,
                'entry_type'      => 'purchase_invoice',
                'amount'          => (float)$request->amount,
                'balance_after'   => $newBal,
                'reference_table' => 'supplier_invoices',
                'reference_id'    => $inv->id,
                'occurred_at'     => now(),
            ]);
        }

        return $inv->load('supplier');
    }

    public function show(Request $request, string $id)
    {
        $tenantId    = $request->user()->tenant_id;
        $supplierIds = Supplier::where('tenant_id', $tenantId)->pluck('id');

        $inv = SupplierInvoice::with(['supplier'])
            ->whereIn('supplier_id', $supplierIds)
            ->find($id);
        if (!$inv) throw new NotFoundException("Supplier invoice {$id} not found.");
        return $inv;
    }

    public function pay(Request $request, string $id)
    {
        $tenantId    = $request->user()->tenant_id;
        $supplierIds = Supplier::where('tenant_id', $tenantId)->pluck('id');

        $inv = SupplierInvoice::whereIn('supplier_id', $supplierIds)->find($id);
        if (!$inv) throw new NotFoundException("Supplier invoice {$id} not found.");
        if ($inv->status === 'paid') throw new ConflictException('Invoice is already paid.');
        if ($inv->status === 'voided') throw new ConflictException('Invoice is voided.');

        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string',
        ]);

        return DB::transaction(function () use ($request, $inv) {
            $outstanding = (float)$inv->amount - (float)$inv->amount_paid;
            $payAmount   = min((float)$request->amount, $outstanding);

            $payment = SupplierPayment::create([
                'id'          => (string) \Illuminate\Support\Str::uuid(),
                'supplier_id' => $inv->supplier_id,
                'amount'      => $payAmount,
                'method'      => $request->method,
                'paid_at'     => now(),
            ]);

            SupplierPaymentAllocation::create([
                'supplier_payment_id' => $payment->id,
                'supplier_invoice_id' => $inv->id,
                'amount_allocated'    => $payAmount,
            ]);

            $newAmountPaid = (float)$inv->amount_paid + $payAmount;
            $newStatus = $newAmountPaid >= (float)$inv->amount - 0.001 ? 'paid' : 'partially_paid';
            $inv->update(['amount_paid' => $newAmountPaid, 'status' => $newStatus]);

            $supplier = Supplier::find($inv->supplier_id);
            if ($supplier) {
                $newBal = (float)$supplier->current_balance - $payAmount;
                $supplier->update(['current_balance' => $newBal]);
                SupplierLedgerEntry::create([
                    'id'              => (string) \Illuminate\Support\Str::uuid(),
                    'supplier_id'     => $inv->supplier_id,
                    'entry_type'      => 'payment',
                    'amount'          => -$payAmount,
                    'balance_after'   => $newBal,
                    'reference_table' => 'supplier_payments',
                    'reference_id'    => $payment->id,
                    'occurred_at'     => now(),
                ]);
            }

            return $inv->fresh(['supplier']);
        });
    }
}
