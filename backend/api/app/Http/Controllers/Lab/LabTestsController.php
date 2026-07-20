<?php

namespace App\Http\Controllers\Lab;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\LabTest;
use App\Exceptions\NotFoundException;

class LabTestsController extends Controller
{
    public function index(Request $request)
    {
        return LabTest::where('tenant_id', $request->user()->tenant_id)
            ->when($request->category, fn($q, $c) => $q->where('category', $c))
            ->when($request->active !== null, fn($q) => $q->where('is_active', $request->active === '1' || $request->active === 'true'))
            ->orderBy('category')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'code'          => 'required|string|max:50',
            'name'          => 'required|string|max:150',
            'category'      => 'nullable|string|max:100',
            'unit'          => 'nullable|string|max:50',
            'normalRange'   => 'nullable|string|max:150',
            'price'         => 'required|numeric|min:0',
            'turnaroundHrs' => 'nullable|integer|min:1',
            'notes'         => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        $exists = LabTest::where('tenant_id', $tenantId)->where('code', $request->code)->exists();
        if ($exists) {
            return response()->json(['error' => 'duplicate_code', 'message' => "Test code '{$request->code}' already exists."], 422);
        }

        return response()->json(
            LabTest::create([
                'id'             => (string) Str::uuid(),
                'tenant_id'      => $tenantId,
                'code'           => strtoupper($request->code),
                'name'           => $request->name,
                'category'       => $request->category,
                'unit'           => $request->unit,
                'normal_range'   => $request->normalRange,
                'price'          => $request->price,
                'turnaround_hrs' => $request->turnaroundHrs ?? 24,
                'notes'          => $request->notes,
            ]),
            201
        );
    }

    public function update(Request $request, string $id)
    {
        $test = LabTest::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$test) throw new NotFoundException("Lab test {$id} not found.");

        $request->validate([
            'name'          => 'sometimes|string|max:150',
            'category'      => 'nullable|string|max:100',
            'unit'          => 'nullable|string|max:50',
            'normalRange'   => 'nullable|string|max:150',
            'price'         => 'sometimes|numeric|min:0',
            'turnaroundHrs' => 'nullable|integer|min:1',
            'isActive'      => 'boolean',
            'notes'         => 'nullable|string',
        ]);

        $test->update(array_filter([
            'name'           => $request->name,
            'category'       => $request->category,
            'unit'           => $request->unit,
            'normal_range'   => $request->normalRange,
            'price'          => $request->price,
            'turnaround_hrs' => $request->turnaroundHrs,
            'is_active'      => $request->has('isActive') ? $request->boolean('isActive') : null,
            'notes'          => $request->notes,
        ], fn($v) => $v !== null));

        return $test;
    }

    public function categories(Request $request)
    {
        return LabTest::where('tenant_id', $request->user()->tenant_id)
            ->whereNotNull('category')
            ->distinct()
            ->pluck('category')
            ->sort()
            ->values();
    }
}
