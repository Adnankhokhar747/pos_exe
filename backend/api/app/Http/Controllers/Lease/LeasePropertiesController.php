<?php

namespace App\Http\Controllers\Lease;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\LeaseProperty;

class LeasePropertiesController extends Controller
{
    public function index(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $query     = LeaseProperty::where('tenant_id', $tenantId);

        if (!$request->boolean('includeInactive')) {
            $query->where('is_active', true);
        }

        $properties = $query->orderBy('name')->get()->map(fn($p) => $this->format($p));

        return response()->json($properties);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:255',
            'type'        => 'required|in:residential,commercial,equipment,other',
            'address'     => 'nullable|string',
            'description' => 'nullable|string',
            'baseRent'    => 'nullable|numeric|min:0',
        ]);

        $property = LeaseProperty::create([
            'id'          => (string) Str::uuid(),
            'tenant_id'   => $request->user()->tenant_id,
            'name'        => $request->name,
            'type'        => $request->type,
            'address'     => $request->address,
            'description' => $request->description,
            'base_rent'   => $request->baseRent ?? 0,
            'is_active'   => true,
        ]);

        return response()->json($this->format($property), 201);
    }

    public function show(Request $request, string $id)
    {
        $property = LeaseProperty::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        return response()->json($this->format($property));
    }

    public function update(Request $request, string $id)
    {
        $property = LeaseProperty::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $request->validate([
            'name'        => 'sometimes|string|max:255',
            'type'        => 'sometimes|in:residential,commercial,equipment,other',
            'address'     => 'nullable|string',
            'description' => 'nullable|string',
            'baseRent'    => 'nullable|numeric|min:0',
            'isActive'    => 'sometimes|boolean',
        ]);

        $data = [];
        if ($request->has('name'))        $data['name']        = $request->name;
        if ($request->has('type'))        $data['type']        = $request->type;
        if ($request->has('address'))     $data['address']     = $request->address;
        if ($request->has('description')) $data['description'] = $request->description;
        if ($request->has('baseRent'))    $data['base_rent']   = $request->baseRent;
        if ($request->has('isActive'))    $data['is_active']   = $request->isActive;

        $property->update($data);

        return response()->json($this->format($property->fresh()));
    }

    private function format(LeaseProperty $p): array
    {
        return [
            'id'          => $p->id,
            'name'        => $p->name,
            'type'        => $p->type,
            'address'     => $p->address,
            'description' => $p->description,
            'baseRent'    => $p->base_rent,
            'isActive'    => $p->is_active,
            'createdAt'   => $p->created_at?->toISOString(),
        ];
    }
}
