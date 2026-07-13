<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\TaxTemplate;
use App\Exceptions\NotFoundException;
use Illuminate\Support\Str;

class TaxTemplatesController extends Controller
{
    public function index(Request $request)
    {
        return TaxTemplate::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get();
    }

    public function show(Request $request, string $id)
    {
        $tpl = TaxTemplate::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$tpl) throw new NotFoundException("Tax template {$id} not found.");
        return $tpl;
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'    => 'required|string',
            'ratePct' => 'required|numeric|min:0',
        ]);

        return TaxTemplate::create([
            'id'           => (string) Str::uuid(),
            'tenant_id'    => $request->user()->tenant_id,
            'name'         => $request->name,
            'tax_type'     => $request->taxType ?? 'custom',
            'rate_pct'     => $request->ratePct,
            'is_inclusive' => $request->isInclusive ?? false,
            'is_active'    => $request->isActive ?? true,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $tpl = TaxTemplate::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$tpl) throw new NotFoundException("Tax template {$id} not found.");

        $data = array_filter([
            'name'         => $request->name,
            'tax_type'     => $request->taxType,
            'rate_pct'     => $request->ratePct,
            'is_inclusive' => $request->has('isInclusive') ? $request->isInclusive : null,
            'is_active'    => $request->has('isActive') ? $request->isActive : null,
        ], fn($v) => $v !== null);

        $tpl->update($data);
        return $tpl;
    }

    public function destroy(Request $request, string $id)
    {
        $tpl = TaxTemplate::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$tpl) throw new NotFoundException("Tax template {$id} not found.");
        $tpl->update(['is_active' => false]);
        return $tpl;
    }
}
