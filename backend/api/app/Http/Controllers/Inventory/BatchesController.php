<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Batch;
use App\Models\Warehouse;
use App\Models\Branch;
use App\Exceptions\NotFoundException;
use Carbon\Carbon;

class BatchesController extends Controller
{
    public function index(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        return Batch::whereIn('warehouse_id', $warehouseIds)
            ->with(['product', 'warehouse'])
            ->when($request->warehouseId, fn($q,$w) => $q->where('warehouse_id',$w))
            ->when($request->productId, fn($q,$p) => $q->where('product_id',$p))
            ->where('quantity_on_hand', '>', 0)
            ->orderBy('expiry_date')
            ->limit(500)
            ->get();
    }

    public function expiring(Request $request)
    {
        $tenantId   = $request->user()->tenant_id;
        $branchIds  = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');
        $withinDays = (int) ($request->withinDays ?? 30);
        $cutoff     = Carbon::now()->addDays($withinDays);

        return Batch::whereIn('warehouse_id', $warehouseIds)
            ->with(['product', 'warehouse'])
            ->when($request->warehouseId, fn($q,$w) => $q->where('warehouse_id',$w))
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<=', $cutoff->toDateString())
            ->where('quantity_on_hand', '>', 0)
            ->orderBy('expiry_date')
            ->limit(200)
            ->get();
    }

    public function show(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        $batch = Batch::with(['product', 'warehouse'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->find($id);
        if (!$batch) throw new NotFoundException("Batch {$id} not found.");
        return $batch;
    }
}
