<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Supplier;
use App\Models\SupplierLedgerEntry;
use App\Exceptions\NotFoundException;

class SuppliersController extends Controller
{
    public function index(Request $request)
    {
        return Supplier::where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
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

        return Supplier::create([
            'id'        => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $request->user()->tenant_id,
            'name'      => $request->name,
            'phone'     => $request->phone,
            'email'     => $request->email,
            'address'   => $request->address,
            'tax_number'=> $request->taxNumber,
        ]);
    }

    public function show(Request $request, string $id)
    {
        $supplier = Supplier::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$supplier) throw new NotFoundException("Supplier {$id} not found.");
        return $supplier;
    }

    public function update(Request $request, string $id)
    {
        $supplier = Supplier::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$supplier) throw new NotFoundException("Supplier {$id} not found.");
        $supplier->update(array_filter($request->only(['name','phone','email','address','tax_number','is_active']), fn($v) => $v !== null));
        return $supplier;
    }

    public function ledger(Request $request, string $id)
    {
        $supplier = Supplier::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$supplier) throw new NotFoundException("Supplier {$id} not found.");
        return SupplierLedgerEntry::where('supplier_id', $id)->orderByDesc('occurred_at')->limit(200)->get();
    }
}
