<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Payment;
use App\Models\Customer;
use App\Models\Patient;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockLedgerEntry;
use App\Models\CustomerLedgerEntry;
use App\Models\PatientLedgerEntry;
use App\Models\Branch;
use App\Models\TenantSubscription;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\LimitExceededError;
use App\Exceptions\ConflictException;

class InvoicesController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return Invoice::whereIn('branch_id', $branchIds)
            ->with(['lines.product','payments','customer','patient'])
            ->when($request->status, fn($q,$s) => $q->where('status',$s))
            ->when($request->branchId, fn($q,$b) => $q->where('branch_id',$b))
            ->when($request->from, fn($q,$f) => $q->where('created_at','>=',$f))
            ->when($request->to, fn($q,$t) => $q->where('created_at','<=',$t))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'branchId' => 'required|uuid',
            'lines'    => 'required|array|min:1',
            'payments' => 'required|array|min:1',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Check invoice limit
        $sub = TenantSubscription::with('plan')->where('tenant_id', $tenantId)->first();
        if ($sub && $sub->plan?->invoice_limit !== null) {
            $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
            $count = Invoice::whereIn('branch_id', $branchIds)->where('status','completed')->count();
            if ($count >= $sub->plan->invoice_limit) {
                throw new LimitExceededError("Invoice limit of {$sub->plan->invoice_limit} reached.");
            }
        }

        return DB::transaction(function () use ($request, $tenantId) {
            $branch = Branch::where('tenant_id', $tenantId)->find($request->branchId);
            if (!$branch) throw new NotFoundException("Branch not found.");

            $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
            $count = Invoice::whereIn('branch_id', $branchIds)->count();
            $invoiceNo = 'INV-' . str_pad($count + 1, 6, '0', STR_PAD_LEFT);

            // Compute all totals server-side — the frontend sends raw line data only.
            $subtotal          = 0.0;
            $lineDiscountTotal = 0.0;
            $taxTotal          = 0.0;
            $computedLines     = [];

            foreach ($request->lines as $line) {
                $qty       = (float)($line['quantity'] ?? 0);
                $price     = (float)($line['unitPrice'] ?? 0);
                $disc      = (float)($line['discountValue'] ?? 0);
                $tax       = (float)($line['taxAmount'] ?? 0);
                $lineTotal = max(0, $qty * $price - $disc + $tax);

                $subtotal          += $qty * $price;
                $lineDiscountTotal += $disc;
                $taxTotal          += $tax;

                $computedLines[] = [
                    'productId'     => $line['productId'],
                    'quantity'      => $qty,
                    'unitPrice'     => $price,
                    'discountValue' => $disc,
                    'taxAmount'     => $tax,
                    'lineTotal'     => $lineTotal,
                ];
            }

            $invoiceDiscount = (float)($request->invoiceDiscountValue ?? 0);
            $discountTotal   = $lineDiscountTotal + $invoiceDiscount;
            $grandTotal      = max(0, $subtotal - $discountTotal + $taxTotal);

            // Validate stock availability — reject before creating the invoice row.
            $warehouseId = \App\Models\Warehouse::where('branch_id', $branch->id)->where('is_default', true)->value('id');
            if ($warehouseId) {
                $productIds  = collect($computedLines)->pluck('productId');
                $stockMap    = StockLevel::where('warehouse_id', $warehouseId)
                    ->whereIn('product_id', $productIds)
                    ->get()->keyBy('product_id');
                $bundleIds   = Product::whereIn('id', $productIds)->where('is_bundle', true)->pluck('id')->toArray();

                foreach ($computedLines as $line) {
                    if (in_array($line['productId'], $bundleIds)) continue;
                    $available = (float)($stockMap->get($line['productId'])?->quantity_on_hand ?? 0);
                    if ($available < $line['quantity']) {
                        $name = Product::where('id', $line['productId'])->value('name') ?? $line['productId'];
                        throw new ConflictException("Insufficient stock for '{$name}'. Available: {$available}.");
                    }
                }
            }

            $invoice = Invoice::create([
                'id'            => (string) \Illuminate\Support\Str::uuid(),
                'branch_id'     => $branch->id,
                'invoice_no'    => $invoiceNo,
                'invoice_type'  => $request->invoiceType ?? 'sale',
                'status'        => $request->status ?? 'completed',
                'customer_id'   => $request->customerId,
                'patient_id'    => $request->patientId,
                'subtotal'      => $subtotal,
                'discount_total'=> $discountTotal,
                'tax_total'     => $taxTotal,
                'grand_total'   => $grandTotal,
                'cashier_id'    => $request->user()->id,
                'held_label'    => $request->heldLabel,
                'currency_code' => $request->currencyCode,
                'coupon_code'   => $request->couponCode,
                'coupon_discount_amount' => $request->couponDiscountAmount ?? 0,
                'loyalty_points_earned'  => $request->loyaltyPointsEarned ?? 0,
                'loyalty_points_redeemed'=> $request->loyaltyPointsRedeemed ?? 0,
            ]);

            foreach ($computedLines as $line) {
                InvoiceLine::create([
                    'id'             => (string) \Illuminate\Support\Str::uuid(),
                    'invoice_id'     => $invoice->id,
                    'product_id'     => $line['productId'],
                    'quantity'       => $line['quantity'],
                    'unit_price'     => $line['unitPrice'],
                    'discount_value' => $line['discountValue'],
                    'tax_amount'     => $line['taxAmount'],
                    'line_total'     => $line['lineTotal'],
                ]);

                if ($invoice->status === 'completed') {
                    $this->deductStock($line['productId'], $line['quantity'], $invoice->id, $branch->id);
                }
            }

            foreach ($request->payments as $pay) {
                Payment::create([
                    'id'             => (string) \Illuminate\Support\Str::uuid(),
                    'invoice_id'     => $invoice->id,
                    'method'         => $pay['method'],
                    'amount'         => $pay['amount'],
                    'received_amount'=> $pay['receivedAmount'] ?? null,
                    'change_amount'  => $pay['changeAmount'] ?? null,
                    'reference'      => $pay['reference'] ?? null,
                ]);

                if ($pay['method'] === 'credit_sale' && $request->customerId) {
                    $this->updateCustomerBalance($request->customerId, (float)$pay['amount']);
                }

                if ($pay['method'] === 'patient_advance' && $request->patientId) {
                    $this->deductPatientAdvance($request->patientId, (float)$pay['amount'], $invoice->invoice_no, $request->user()->id);
                }
            }

            // Generate ZATCA Phase 1 QR code if e-invoice module is enabled
            $einvoiceEnabled = DB::table('tenant_modules')
                ->join('module_catalog', 'tenant_modules.module_id', '=', 'module_catalog.id')
                ->where('tenant_modules.tenant_id', $tenantId)
                ->where('module_catalog.code', 'einvoice')
                ->where('tenant_modules.enabled', true)
                ->exists();

            if ($einvoiceEnabled && $invoice->status === 'completed') {
                $settings = \App\Models\EInvoiceSettings::where('tenant_id', $tenantId)->first();
                if ($settings && $settings->is_active) {
                    $service    = app(\App\Services\EInvoiceService::class);
                    $vatRate    = (float)($settings->vat_rate ?? 15);
                    $taxTotal   = (float)$invoice->tax_total;
                    $grandTotal = (float)$invoice->grand_total;
                    $vatAmount  = $taxTotal > 0
                        ? $taxTotal
                        : $service->extractVat($grandTotal, $vatRate);

                    $qr = $service->generateTlvQr(
                        $settings->seller_name_en ?? $settings->seller_name_ar ?? '',
                        $settings->vat_number    ?? '',
                        now()->toIso8601String(),
                        number_format($grandTotal, 2, '.', ''),
                        number_format($vatAmount,  2, '.', '')
                    );

                    $invoice->update([
                        'einvoice_qr'   => $qr,
                        'einvoice_uuid' => (string) \Illuminate\Support\Str::uuid(),
                    ]);
                }
            }

            return $invoice->load(['lines.product','payments','customer','patient']);
        });
    }

    public function show(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $invoice = Invoice::with(['lines.product','payments','customer','patient'])
            ->whereIn('branch_id', $branchIds)
            ->find($id);
        if (!$invoice) throw new NotFoundException("Invoice {$id} not found.");
        return $invoice;
    }

    public function update(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $invoice = Invoice::whereIn('branch_id', $branchIds)->find($id);
        if (!$invoice) throw new NotFoundException("Invoice {$id} not found.");
        if ($invoice->status === 'voided') throw new ConflictException('Cannot update a voided invoice.');

        $invoice->update(array_filter([
            'status'     => $request->status,
            'held_label' => $request->heldLabel,
        ], fn($v) => $v !== null));

        return $invoice->load(['lines.product','payments']);
    }

    public function void(Request $request, string $id)
    {
        $request->validate(['reason' => 'required|string']);
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $invoice = Invoice::with(['lines','payments'])->whereIn('branch_id', $branchIds)->find($id);
        if (!$invoice) throw new NotFoundException("Invoice {$id} not found.");
        if ($invoice->status === 'voided') throw new ConflictException('Invoice already voided.');

        return DB::transaction(function () use ($request, $invoice) {
            $invoice->update([
                'status'     => 'voided',
                'void_reason'=> $request->reason,
                'voided_by'  => $request->user()->id,
                'voided_at'  => now(),
            ]);

            // Reverse stock movements
            foreach ($invoice->lines as $line) {
                $this->restoreStock($line->product_id, $line->quantity, $invoice->id, $invoice->branch_id);
            }

            // Reverse patient advance deductions
            foreach ($invoice->payments as $pay) {
                if ($pay->method === 'patient_advance' && $invoice->patient_id) {
                    $patient = Patient::find($invoice->patient_id);
                    if ($patient) {
                        $newBal = (float)$patient->current_balance + (float)$pay->amount;
                        $patient->update(['current_balance' => $newBal]);
                        PatientLedgerEntry::create([
                            'id'           => (string) \Illuminate\Support\Str::uuid(),
                            'tenant_id'    => $patient->tenant_id,
                            'patient_id'   => $patient->id,
                            'entry_type'   => 'advance',
                            'amount'       => (float)$pay->amount,
                            'balance_after'=> $newBal,
                            'description'  => "Advance restored — Invoice #{$invoice->invoice_no} voided",
                            'created_by'   => $request->user()->id,
                        ]);
                    }
                }
            }

            return $invoice->fresh(['lines','payments']);
        });
    }

    public function listHeld(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return Invoice::whereIn('branch_id', $branchIds)
            ->where('status', 'held')
            ->with(['lines.product', 'customer'])
            ->when($request->branchId, fn($q,$b) => $q->where('branch_id',$b))
            ->orderBy('created_at')
            ->get();
    }

    public function hold(Request $request)
    {
        $request->validate([
            'branchId' => 'required|uuid',
            'lines'    => 'required|array|min:1',
        ]);

        $tenantId = $request->user()->tenant_id;

        return DB::transaction(function () use ($request, $tenantId) {
            $branch = Branch::where('tenant_id', $tenantId)->find($request->branchId);
            if (!$branch) throw new NotFoundException('Branch not found.');

            $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
            $count     = Invoice::whereIn('branch_id', $branchIds)->count();
            $invoiceNo = 'INV-' . str_pad($count + 1, 6, '0', STR_PAD_LEFT);

            $invoice = Invoice::create([
                'id'          => (string) \Illuminate\Support\Str::uuid(),
                'branch_id'   => $branch->id,
                'invoice_no'  => $invoiceNo,
                'invoice_type'=> 'sale',
                'status'      => 'held',
                'customer_id' => $request->customerId,
                'held_label'  => $request->heldLabel,
                'cashier_id'  => $request->user()->id,
                'subtotal'    => 0,
                'discount_total' => 0,
                'tax_total'   => 0,
                'grand_total' => 0,
            ]);

            foreach ($request->lines as $line) {
                InvoiceLine::create([
                    'id'             => (string) \Illuminate\Support\Str::uuid(),
                    'invoice_id'     => $invoice->id,
                    'product_id'     => $line['productId'],
                    'quantity'       => $line['quantity'],
                    'unit_price'     => $line['unitPrice'],
                    'discount_value' => $line['discountValue'] ?? 0,
                    'tax_amount'     => 0,
                    'line_total'     => (float)$line['quantity'] * (float)$line['unitPrice'],
                ]);
            }

            return $invoice->load(['lines.product', 'customer']);
        });
    }

    public function resume(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return DB::transaction(function () use ($id, $branchIds) {
            $invoice = Invoice::with(['lines.product', 'customer'])
                ->whereIn('branch_id', $branchIds)
                ->where('status', 'held')
                ->find($id);
            if (!$invoice) throw new NotFoundException("Held invoice {$id} not found.");

            InvoiceLine::where('invoice_id', $id)->delete();
            $invoice->delete();

            return $invoice;
        });
    }

    public function createReturn(Request $request, string $id)
    {
        $request->validate([
            'lines'        => 'required|array|min:1',
            'refundMethod' => 'nullable|string',
        ]);

        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return DB::transaction(function () use ($request, $id, $branchIds, $tenantId) {
            $original = Invoice::with(['lines'])->whereIn('branch_id', $branchIds)->find($id);
            if (!$original) throw new NotFoundException("Invoice {$id} not found.");

            $branchIds2 = Branch::where('tenant_id', $tenantId)->pluck('id');
            $count      = Invoice::whereIn('branch_id', $branchIds2)->count();
            $returnNo   = 'INV-' . str_pad($count + 1, 6, '0', STR_PAD_LEFT);

            $subtotal = 0;
            $taxTotal = 0;
            $returnLines = [];

            foreach ($request->lines as $requested) {
                $origLine = $original->lines->firstWhere('id', $requested['invoiceLineId']);
                if (!$origLine) continue;

                $returnQty   = (float) $requested['quantity'];
                $proportion  = $origLine->quantity > 0 ? $returnQty / (float)$origLine->quantity : 1;
                $lineSubtotal= $returnQty * (float)$origLine->unit_price;
                $lineTax     = (float)$origLine->tax_amount * $proportion;

                $subtotal += $lineSubtotal;
                $taxTotal += $lineTax;

                $returnLines[] = [
                    'product_id'              => $origLine->product_id,
                    'quantity'                => $returnQty,
                    'unit_price'              => $origLine->unit_price,
                    'tax_amount'              => $lineTax,
                    'line_total'              => $lineSubtotal + $lineTax,
                    'original_invoice_line_id'=> $origLine->id,
                ];
            }

            $grandTotal = $subtotal + $taxTotal;

            $returnInvoice = Invoice::create([
                'id'                  => (string) \Illuminate\Support\Str::uuid(),
                'branch_id'           => $original->branch_id,
                'invoice_no'          => $returnNo,
                'invoice_type'        => 'return',
                'status'              => 'completed',
                'customer_id'         => $original->customer_id,
                'original_invoice_id' => $original->id,
                'subtotal'            => $subtotal,
                'discount_total'      => 0,
                'tax_total'           => $taxTotal,
                'grand_total'         => $grandTotal,
                'cashier_id'          => $request->user()->id,
            ]);

            foreach ($returnLines as $line) {
                InvoiceLine::create(array_merge(
                    ['id' => (string) \Illuminate\Support\Str::uuid(), 'invoice_id' => $returnInvoice->id],
                    $line
                ));

                $this->restoreStock($line['product_id'], $line['quantity'], $returnInvoice->id, $original->branch_id);
            }

            Payment::create([
                'id'         => (string) \Illuminate\Support\Str::uuid(),
                'invoice_id' => $returnInvoice->id,
                'method'     => $request->refundMethod ?? 'cash',
                'amount'     => $grandTotal,
            ]);

            return $returnInvoice->load(['lines.product', 'payments']);
        });
    }

    private function deductStock(string $productId, float $qty, string $invoiceId, string $branchId): void
    {
        $warehouseId = \App\Models\Warehouse::where('branch_id', $branchId)->where('is_default', true)->value('id');
        if (!$warehouseId) return;

        DB::statement(
            "INSERT INTO stock_levels (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
             VALUES (?, ?, 0, 0)
             ON DUPLICATE KEY UPDATE quantity_on_hand = GREATEST(0, quantity_on_hand - ?)",
            [$warehouseId, $productId, $qty]
        );

        StockLedgerEntry::create([
            'id'             => (string) \Illuminate\Support\Str::uuid(),
            'warehouse_id'   => $warehouseId,
            'product_id'     => $productId,
            'movement_type'  => 'sale',
            'quantity_delta' => -$qty,
            'reference_table'=> 'invoices',
            'reference_id'   => $invoiceId,
        ]);
    }

    private function restoreStock(string $productId, float $qty, string $invoiceId, string $branchId): void
    {
        $warehouseId = \App\Models\Warehouse::where('branch_id', $branchId)->where('is_default', true)->value('id');
        if (!$warehouseId) return;

        DB::statement(
            "INSERT INTO stock_levels (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
             VALUES (?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE quantity_on_hand = quantity_on_hand + VALUES(quantity_on_hand)",
            [$warehouseId, $productId, $qty]
        );

        StockLedgerEntry::create([
            'id'             => (string) \Illuminate\Support\Str::uuid(),
            'warehouse_id'   => $warehouseId,
            'product_id'     => $productId,
            'movement_type'  => 'sale_return',
            'quantity_delta' => $qty,
            'reference_table'=> 'invoices',
            'reference_id'   => $invoiceId,
        ]);
    }

    private function updateCustomerBalance(string $customerId, float $amount): void
    {
        $customer = Customer::find($customerId);
        if (!$customer) return;
        $newBal = (float)$customer->current_balance + $amount;
        $customer->update(['current_balance' => $newBal]);
        CustomerLedgerEntry::create([
            'id'             => (string) \Illuminate\Support\Str::uuid(),
            'customer_id'    => $customerId,
            'entry_type'     => 'invoice',
            'amount'         => $amount,
            'balance_after'  => $newBal,
        ]);
    }

    private function deductPatientAdvance(string $patientId, float $amount, string $invoiceId, string $userId): void
    {
        $patient = Patient::find($patientId);
        if (!$patient) return;
        $deduct = min($amount, (float)$patient->current_balance);
        if ($deduct <= 0) return;
        $newBal = (float)$patient->current_balance - $deduct;
        $patient->update(['current_balance' => $newBal]);
        PatientLedgerEntry::create([
            'id'           => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id'    => $patient->tenant_id,
            'patient_id'   => $patientId,
            'entry_type'   => 'charge',
            'amount'       => -$deduct,
            'balance_after'=> $newBal,
            'description'  => "POS purchase — Invoice #{$invoiceId}",
            'created_by'   => $userId,
        ]);
    }
}
