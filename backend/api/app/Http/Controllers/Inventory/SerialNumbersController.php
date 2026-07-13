<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SerialNumber;
use App\Models\Warehouse;
use App\Models\Branch;
use App\Exceptions\NotFoundException;

class SerialNumbersController extends Controller
{
    public function index(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        return SerialNumber::whereIn('warehouse_id', $warehouseIds)
            ->with(['product', 'warehouse'])
            ->when($request->warehouseId, fn($q,$w) => $q->where('warehouse_id',$w))
            ->when($request->productId, fn($q,$p) => $q->where('product_id',$p))
            ->when($request->status, fn($q,$s) => $q->where('status',$s))
            ->orderByDesc('created_at')
            ->limit(500)
            ->get();
    }

    public function show(Request $request, string $id)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $warehouseIds = Warehouse::whereIn('branch_id', $branchIds)->pluck('id');

        $serial = SerialNumber::with(['product', 'warehouse'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->find($id);
        if (!$serial) throw new NotFoundException("Serial number {$id} not found.");
        return $serial;
    }
}
