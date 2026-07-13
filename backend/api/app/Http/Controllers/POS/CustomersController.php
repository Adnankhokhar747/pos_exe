<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Customer;
use App\Models\CustomerLedgerEntry;
use Illuminate\Support\Facades\DB;
use App\Models\LoyaltyTransaction;
use App\Exceptions\NotFoundException;
use App\Exceptions\InsufficientBalanceError;

class CustomersController extends Controller
{
    public function index(Request $request)
    {
        return Customer::where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->where('is_walk_in', false)
            ->when($request->search, fn($q,$s) =>
                $q->where(function($q) use ($s) {
                    $q->where('name','ilike',"%{$s}%")
                      ->orWhere('phone','ilike',"%{$s}%");
                })
            )
            ->orderBy('name')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string']);

        return Customer::create([
            'id'           => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id'    => $request->user()->tenant_id,
            'name'         => $request->name,
            'phone'        => $request->phone,
            'email'        => $request->email,
            'address'      => $request->address,
            'tax_number'   => $request->taxNumber,
            'credit_limit' => $request->creditLimit ?? 0,
        ]);
    }

    public function show(Request $request, string $id)
    {
        $customer = Customer::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$customer) throw new NotFoundException("Customer {$id} not found.");
        return $customer;
    }

    public function update(Request $request, string $id)
    {
        $customer = Customer::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$customer) throw new NotFoundException("Customer {$id} not found.");

        $customer->update(array_filter([
            'name'         => $request->name,
            'phone'        => $request->phone,
            'email'        => $request->email,
            'address'      => $request->address,
            'tax_number'   => $request->taxNumber,
            'credit_limit' => $request->creditLimit,
            'is_active'    => $request->isActive,
        ], fn($v) => $v !== null));

        return $customer;
    }

    public function ledger(Request $request, string $id)
    {
        $customer = Customer::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$customer) throw new NotFoundException("Customer {$id} not found.");

        return CustomerLedgerEntry::where('customer_id', $id)
            ->orderByDesc('occurred_at')
            ->limit(200)
            ->get();
    }

    public function loyaltyTransactions(Request $request, string $id)
    {
        $customer = Customer::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$customer) throw new NotFoundException("Customer {$id} not found.");

        return LoyaltyTransaction::where('customer_id', $id)
            ->orderByDesc('occurred_at')
            ->limit(200)
            ->get();
    }

    public function recordPayment(Request $request, string $id)
    {
        $request->validate(['amount' => 'required|numeric|min:0.01', 'method' => 'required|string']);
        $customer = Customer::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$customer) throw new NotFoundException("Customer {$id} not found.");

        return DB::transaction(function () use ($request, $customer) {
            $amount = (float)$request->amount;
            $newBalance = (float)$customer->current_balance - $amount;
            $customer->update(['current_balance' => $newBalance]);

            return CustomerLedgerEntry::create([
                'id'             => (string) \Illuminate\Support\Str::uuid(),
                'customer_id'    => $customer->id,
                'entry_type'     => 'payment',
                'amount'         => -$amount,
                'balance_after'  => $newBalance,
                'note'           => $request->note ?? "Payment via {$request->method}",
            ]);
        });
    }
}
