<?php

namespace App\Http\Controllers\Lab;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Category;
use App\Models\Product;
use App\Models\Patient;
use App\Exceptions\NotFoundException;

class PharmacyController extends Controller
{
    // ── Category pharmacy flag ─────────────────────────────────────────────────

    public function listCategories(Request $request)
    {
        try {
            return Category::where('tenant_id', $request->user()->tenant_id)
                ->whereNull('parent_id')
                ->orderBy('name')
                ->get(['id', 'name', 'is_pharmacy']);
        } catch (\Exception $e) {
            // is_pharmacy column missing — migration not run yet
            return Category::where('tenant_id', $request->user()->tenant_id)
                ->whereNull('parent_id')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn($c) => array_merge($c->toArray(), ['is_pharmacy' => false]));
        }
    }

    public function togglePharmacy(Request $request, string $id)
    {
        $cat = Category::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$cat) throw new NotFoundException("Category {$id} not found.");

        $request->validate(['isPharmacy' => 'required|boolean']);
        try {
            $cat->update(['is_pharmacy' => $request->boolean('isPharmacy')]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'migration_required', 'message' => 'Run the lab/pharmacy migration first.'], 500);
        }
        return $cat;
    }

    // ── Pharmacy POS data ──────────────────────────────────────────────────────

    public function pharmacyProducts(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        try {
            $pharmacyCategoryIds = Category::where('tenant_id', $tenantId)
                ->where('is_pharmacy', true)
                ->pluck('id');
        } catch (\Exception $e) {
            // is_pharmacy column missing — migration not run yet, return empty
            return [];
        }

        return Product::where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->whereIn('category_id', $pharmacyCategoryIds)
            ->with('category:id,name')
            ->orderBy('name')
            ->get();
    }

    public function patients(Request $request)
    {
        $q = $request->query('q', '');
        return Patient::where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->when($q, fn($query) => $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%");
            }))
            ->orderBy('name')
            ->limit(50)
            ->get(['id', 'name', 'phone', 'gender']);
    }
}
