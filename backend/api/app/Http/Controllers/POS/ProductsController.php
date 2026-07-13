<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\BundleComponent;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;

class ProductsController extends Controller
{
    public function index(Request $request)
    {
        return Product::where('tenant_id', $request->user()->tenant_id)
            ->whereNull('deleted_at')
            ->with(['category','stockLevels'])
            ->when($request->search, fn($q, $s) =>
                $q->where(function($q) use ($s) {
                    $q->where('name','ilike',"%{$s}%")
                      ->orWhere('sku','ilike',"%{$s}%")
                      ->orWhere('barcode','ilike',"%{$s}%");
                })
            )
            ->when($request->categoryId, fn($q,$c) => $q->where('category_id',$c))
            ->when($request->parentProductId, fn($q,$p) => $q->where('parent_product_id',$p))
            ->when($request->isBundle !== null, fn($q) => $q->where('is_bundle', filter_var($request->isBundle, FILTER_VALIDATE_BOOLEAN)))
            ->orderBy('name')
            ->limit(500)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'sku'       => 'required|string',
            'name'      => 'required|string',
            'salePrice' => 'required|numeric|min:0',
        ]);

        $product = Product::create([
            'id'               => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id'        => $request->user()->tenant_id,
            'sku'              => $request->sku,
            'barcode'          => $request->barcode,
            'name'             => $request->name,
            'description'      => $request->description,
            'category_id'      => $request->categoryId,
            'cost_price'       => $request->costPrice ?? 0,
            'sale_price'       => $request->salePrice,
            'tax_rate_pct'     => $request->taxRatePct ?? 0,
            'tax_template_id'  => $request->taxTemplateId,
            'reorder_level'    => $request->reorderLevel ?? 0,
            'parent_product_id'=> $request->parentProductId,
            'variant_attributes'=> $request->variantAttributes,
            'is_bundle'        => $request->isBundle ?? false,
            'track_batches'    => $request->trackBatches ?? false,
            'track_serials'    => $request->trackSerials ?? false,
        ]);

        return $product->load(['category','stockLevels']);
    }

    public function show(Request $request, string $id)
    {
        $product = Product::with(['category','variants','stockLevels'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereNull('deleted_at')
            ->find($id);
        if (!$product) throw new NotFoundException("Product {$id} not found.");
        return $product;
    }

    public function update(Request $request, string $id)
    {
        $product = Product::where('tenant_id', $request->user()->tenant_id)->whereNull('deleted_at')->find($id);
        if (!$product) throw new NotFoundException("Product {$id} not found.");

        $product->update(array_filter([
            'sku'              => $request->sku,
            'barcode'          => $request->barcode,
            'name'             => $request->name,
            'description'      => $request->description,
            'category_id'      => $request->categoryId,
            'cost_price'       => $request->costPrice,
            'sale_price'       => $request->salePrice,
            'tax_rate_pct'     => $request->taxRatePct,
            'tax_template_id'  => $request->taxTemplateId,
            'reorder_level'    => $request->reorderLevel,
            'variant_attributes'=> $request->variantAttributes,
            'is_bundle'        => $request->isBundle,
            'track_batches'    => $request->trackBatches,
            'track_serials'    => $request->trackSerials,
        ], fn($v) => $v !== null));

        return $product->load(['category','stockLevels']);
    }

    public function destroy(Request $request, string $id)
    {
        $product = Product::where('tenant_id', $request->user()->tenant_id)->whereNull('deleted_at')->find($id);
        if (!$product) throw new NotFoundException("Product {$id} not found.");
        $product->update(['deleted_at' => now()]);
        return response()->json(['message' => 'Product deleted.']);
    }

    public function byBarcode(Request $request)
    {
        $request->validate(['barcode' => 'required|string']);
        $product = Product::with(['category', 'stockLevels'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereNull('deleted_at')
            ->where('barcode', $request->barcode)
            ->first();
        if (!$product) throw new NotFoundException("No product with barcode '{$request->barcode}'.");
        return $product;
    }

    public function variants(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $parent   = Product::where('tenant_id', $tenantId)->whereNull('deleted_at')->find($id);
        if (!$parent) throw new NotFoundException("Product {$id} not found.");

        return Product::where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->where('parent_product_id', $id)
            ->with(['category', 'stockLevels'])
            ->orderBy('name')
            ->get();
    }

    public function bundleComponents(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $bundle   = Product::where('tenant_id', $tenantId)->whereNull('deleted_at')->find($id);
        if (!$bundle) throw new NotFoundException("Product {$id} not found.");

        return BundleComponent::where('bundle_product_id', $id)
            ->with(['componentProduct'])
            ->get();
    }

    public function updateBundleComponents(Request $request, string $id)
    {
        $request->validate([
            'components'                   => 'required|array',
            'components.*.componentProductId' => 'required|uuid',
            'components.*.quantity'        => 'required|numeric|min:0.0001',
        ]);

        $tenantId = $request->user()->tenant_id;
        $bundle   = Product::where('tenant_id', $tenantId)->whereNull('deleted_at')->find($id);
        if (!$bundle) throw new NotFoundException("Product {$id} not found.");

        return DB::transaction(function () use ($request, $id) {
            BundleComponent::where('bundle_product_id', $id)->delete();

            $components = [];
            foreach ($request->components as $comp) {
                $components[] = BundleComponent::create([
                    'id'                   => (string) \Illuminate\Support\Str::uuid(),
                    'bundle_product_id'    => $id,
                    'component_product_id' => $comp['componentProductId'],
                    'quantity'             => $comp['quantity'],
                ]);
            }

            return $components;
        });
    }

    public function posGrid(Request $request)
    {
        $tenantId    = $request->user()->tenant_id;
        $warehouseId = $request->warehouseId;
        $search      = $request->search;

        $products = Product::where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->when($search, fn($q) =>
                $q->where(function($q) use ($search) {
                    $q->where('name','ilike',"%{$search}%")
                      ->orWhere('sku','ilike',"%{$search}%")
                      ->orWhere('barcode','ilike',"%{$search}%");
                })
            )
            ->orderBy('name')
            ->limit(200)
            ->get();

        $stockLevels = StockLevel::where('warehouse_id', $warehouseId)
            ->whereIn('product_id', $products->pluck('id'))
            ->get()
            ->keyBy('product_id');

        return $products->map(function($product) use ($stockLevels) {
            $stock = $stockLevels->get($product->id);
            return array_merge($product->toArray(), [
                'quantityOnHand' => $product->is_bundle
                    ? '∞'
                    : ($stock ? (string) $stock->quantity_on_hand : '0'),
            ]);
        });
    }
}
