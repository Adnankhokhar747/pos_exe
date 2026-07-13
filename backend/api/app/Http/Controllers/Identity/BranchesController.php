<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Branch;
use App\Models\Warehouse;
use App\Exceptions\NotFoundException;
use App\Exceptions\LimitExceededError;
use App\Models\TenantSubscription;
use App\Models\Plan;

class BranchesController extends Controller
{
    public function index(Request $request)
    {
        return Branch::where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->with('warehouses')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'     => 'required|string',
            'code'     => 'required|string',
            'timezone' => 'string',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Check branch limit
        $sub = TenantSubscription::with('plan')->where('tenant_id', $tenantId)->first();
        if ($sub && $sub->plan->branch_limit !== null) {
            $count = Branch::where('tenant_id', $tenantId)->where('is_active', true)->count();
            if ($count >= $sub->plan->branch_limit) {
                throw new LimitExceededError("Branch limit of {$sub->plan->branch_limit} reached.");
            }
        }

        $branch = Branch::create([
            'id'        => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenantId,
            'name'      => $request->name,
            'code'      => strtoupper($request->code),
            'timezone'  => $request->timezone ?? 'UTC',
        ]);

        Warehouse::create([
            'id'         => (string) \Illuminate\Support\Str::uuid(),
            'branch_id'  => $branch->id,
            'name'       => 'Main Warehouse',
            'is_default' => true,
        ]);

        return $branch->load('warehouses');
    }

    public function show(Request $request, string $id)
    {
        $branch = Branch::with('warehouses')
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$branch) throw new NotFoundException("Branch {$id} not found.");
        return $branch;
    }

    public function update(Request $request, string $id)
    {
        $branch = Branch::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$branch) throw new NotFoundException("Branch {$id} not found.");
        $branch->update($request->only(['name','code','timezone','is_active']));
        return $branch;
    }
}
