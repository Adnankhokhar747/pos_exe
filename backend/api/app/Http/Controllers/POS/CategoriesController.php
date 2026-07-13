<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Category;
use App\Exceptions\NotFoundException;

class CategoriesController extends Controller
{
    public function index(Request $request)
    {
        return Category::where('tenant_id', $request->user()->tenant_id)
            ->with('children')
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    public function show(Request $request, string $id)
    {
        $category = Category::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$category) throw new NotFoundException("Category {$id} not found.");
        return $category;
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string']);

        return Category::create([
            'id'        => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $request->user()->tenant_id,
            'name'      => $request->name,
            'parent_id' => $request->parentId,
            'sort_order'=> $request->sortOrder ?? 0,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $category = Category::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$category) throw new NotFoundException("Category {$id} not found.");
        $category->update($request->only(['name','parent_id','sort_order']));
        return $category;
    }

    public function destroy(Request $request, string $id)
    {
        $category = Category::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$category) throw new NotFoundException("Category {$id} not found.");
        $category->delete();
        return response()->json(['message' => 'Category deleted.']);
    }
}
