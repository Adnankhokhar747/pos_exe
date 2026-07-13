<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ModuleCatalog;
use App\Models\TenantModule;
use App\Models\Tenant;
use App\Exceptions\NotFoundException;
use Carbon\Carbon;

class ModuleCatalogController extends Controller
{
    public function index()
    {
        return ModuleCatalog::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'code'        => 'required|string|unique:module_catalog,code',
            'name'        => 'required|string',
            'description' => 'nullable|string',
        ]);

        return ModuleCatalog::create([
            'id'          => (string) \Illuminate\Support\Str::uuid(),
            'code'        => $request->code,
            'name'        => $request->name,
            'description' => $request->description,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $catalog = ModuleCatalog::find($id);
        if (!$catalog) throw new NotFoundException("Module {$id} not found.");
        $catalog->update($request->only(['name','description','is_active']));
        return $catalog;
    }

    // Tenant module grants
    public function listForCompany(string $companyId)
    {
        $tenant = Tenant::find($companyId);
        if (!$tenant) throw new NotFoundException("Company {$companyId} not found.");

        $catalogs = ModuleCatalog::where('is_active', true)->get();
        $grants   = TenantModule::where('tenant_id', $companyId)->get()->keyBy('module_id');

        return $catalogs->map(function ($cat) use ($grants) {
            $grant = $grants->get($cat->id);
            return [
                'moduleCode'     => $cat->code,
                'moduleName'     => $cat->name,
                'description'    => $cat->description,
                'enabled'        => $grant ? $grant->enabled : false,
                'startDate'      => $grant?->start_date,
                'expiryDate'     => $grant?->expiry_date,
                'gracePeriodDays'=> $grant?->grace_period_days ?? 7,
                'limits'         => $grant?->limits,
            ];
        });
    }

    public function upsertForCompany(Request $request, string $companyId, string $moduleCode)
    {
        $request->validate([
            'enabled'        => 'required|boolean',
            'periodMonths'   => 'nullable|integer|min:1',
            'limits'         => 'nullable|array',
            'gracePeriodDays'=> 'nullable|integer|min:0',
        ]);

        $tenant = Tenant::find($companyId);
        if (!$tenant) throw new NotFoundException("Company {$companyId} not found.");

        $catalog = ModuleCatalog::where('code', $moduleCode)->first();
        if (!$catalog) throw new NotFoundException("Module '{$moduleCode}' not found in catalog.");

        $existing = TenantModule::where('tenant_id', $companyId)
            ->where('module_id', $catalog->id)
            ->first();

        $data = [
            'enabled'         => $request->enabled,
            'grace_period_days'=> $request->gracePeriodDays ?? ($existing->grace_period_days ?? 7),
        ];

        if ($request->enabled && $request->has('periodMonths')) {
            $months = $request->periodMonths ?? 12;
            $data['start_date']  = now();
            $data['expiry_date'] = now()->addMonths($months);
        }

        if ($request->has('limits')) {
            $data['limits'] = $request->limits;
        }

        if ($existing) {
            $existing->update($data);
            return $existing->load('module');
        }

        return TenantModule::create(array_merge($data, [
            'id'        => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $companyId,
            'module_id' => $catalog->id,
        ]))->load('module');
    }
}
