<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Plan;
use App\Exceptions\NotFoundException;

class PlansController extends Controller
{
    public function index()
    {
        return Plan::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'         => 'required|string|unique:plans,name',
            'userLimit'    => 'nullable|integer|min:1',
            'invoiceLimit' => 'nullable|integer|min:1',
            'branchLimit'  => 'nullable|integer|min:1',
            'priceMonthly' => 'nullable|numeric|min:0',
        ]);

        return Plan::create([
            'id'            => (string) \Illuminate\Support\Str::uuid(),
            'name'          => $request->name,
            'user_limit'    => $request->userLimit,
            'invoice_limit' => $request->invoiceLimit,
            'branch_limit'  => $request->branchLimit,
            'price_monthly' => $request->priceMonthly,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $plan = Plan::find($id);
        if (!$plan) throw new NotFoundException("Plan {$id} not found.");

        $plan->update($request->only(['name','user_limit','invoice_limit','branch_limit','price_monthly','is_active']));
        return $plan;
    }
}
