<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\Category;
use Illuminate\Support\Facades\DB;

class RestaurantMenuSettingsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $settings = DB::table('restaurant_menu_settings')
            ->where('tenant_id', $tenantId)
            ->pluck('sort_order', 'category_id')
            ->toArray();

        $visibilityMap = DB::table('restaurant_menu_settings')
            ->where('tenant_id', $tenantId)
            ->pluck('is_visible', 'category_id')
            ->toArray();

        return Category::where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get()
            ->map(function ($cat) use ($settings, $visibilityMap) {
                return [
                    'categoryId'   => $cat->id,
                    'categoryName' => $cat->name,
                    'isVisible'    => isset($visibilityMap[$cat->id]) ? (bool)$visibilityMap[$cat->id] : true,
                    'sortOrder'    => $settings[$cat->id] ?? 0,
                ];
            })
            ->sortBy('sortOrder')
            ->values();
    }

    public function upsert(Request $request)
    {
        $request->validate([
            'settings'               => 'required|array',
            'settings.*.categoryId'  => 'required|uuid',
            'settings.*.isVisible'   => 'required|boolean',
            'settings.*.sortOrder'   => 'required|integer|min:0',
        ]);

        $tenantId = $request->user()->tenant_id;
        $now      = now();

        foreach ($request->settings as $row) {
            DB::table('restaurant_menu_settings')->upsert(
                [
                    'id'          => (string) Str::uuid(),
                    'tenant_id'   => $tenantId,
                    'category_id' => $row['categoryId'],
                    'is_visible'  => $row['isVisible'] ? 1 : 0,
                    'sort_order'  => $row['sortOrder'],
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ],
                ['tenant_id', 'category_id'],
                ['is_visible', 'sort_order', 'updated_at']
            );
        }

        return response()->json(['message' => 'Menu settings updated.']);
    }
}
