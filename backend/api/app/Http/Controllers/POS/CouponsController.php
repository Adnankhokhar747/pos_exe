<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Coupon;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class CouponsController extends Controller
{
    public function index(Request $request)
    {
        return Coupon::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'code'          => 'required|string',
            'discountType'  => 'required|in:percentage,fixed',
            'discountValue' => 'required|numeric|min:0',
        ]);

        $tenantId = $request->user()->tenant_id;
        $code = strtoupper($request->code);

        $exists = Coupon::where('tenant_id', $tenantId)->where('code', $code)->exists();
        if ($exists) throw new ConflictException("Coupon code '{$code}' already exists.");

        return Coupon::create([
            'id'             => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id'      => $tenantId,
            'code'           => $code,
            'discount_type'  => $request->discountType,
            'discount_value' => $request->discountValue,
            'expiry_date'    => $request->expiryDate,
            'usage_limit'    => $request->usageLimit,
            'is_active'      => $request->isActive ?? true,
            'created_at'     => now(),
        ]);
    }

    public function show(Request $request, string $id)
    {
        $coupon = Coupon::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$coupon) throw new NotFoundException("Coupon {$id} not found.");
        return $coupon;
    }

    public function update(Request $request, string $id)
    {
        $coupon = Coupon::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$coupon) throw new NotFoundException("Coupon {$id} not found.");

        $coupon->update(array_filter([
            'discount_type'  => $request->discountType,
            'discount_value' => $request->discountValue,
            'expiry_date'    => $request->expiryDate,
            'usage_limit'    => $request->usageLimit,
            'is_active'      => $request->isActive,
        ], fn($v) => $v !== null));

        return $coupon;
    }

    public function destroy(Request $request, string $id)
    {
        $coupon = Coupon::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$coupon) throw new NotFoundException("Coupon {$id} not found.");
        $coupon->update(['is_active' => false]);
        return response()->json(['message' => 'Coupon deactivated.']);
    }

    public function validate(Request $request)
    {
        $request->validate([
            'code'     => 'required|string',
            'subtotal' => 'required|numeric|min:0',
        ]);

        $tenantId = $request->user()->tenant_id;
        $code     = strtoupper($request->code);
        $subtotal = (float) $request->subtotal;

        $coupon = Coupon::where('tenant_id', $tenantId)->where('code', $code)->first();
        if (!$coupon) throw new NotFoundException("Coupon '{$code}' not found.");
        if (!$coupon->is_active) throw new ConflictException("Coupon '{$code}' is inactive.");
        if ($coupon->expiry_date && now()->gt($coupon->expiry_date)) {
            throw new ConflictException("Coupon '{$code}' has expired.");
        }
        if ($coupon->usage_limit !== null && $coupon->usage_count >= $coupon->usage_limit) {
            throw new ConflictException("Coupon '{$code}' usage limit reached.");
        }

        $discount = $coupon->discount_type === 'percentage'
            ? round($subtotal * ((float)$coupon->discount_value / 100), 4)
            : min((float)$coupon->discount_value, $subtotal);

        return response()->json([
            'coupon'   => $coupon,
            'discount' => (string) $discount,
        ]);
    }
}
