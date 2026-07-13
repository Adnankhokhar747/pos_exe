<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Role;
use App\Models\Permission;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ForbiddenException;

class RolesController extends Controller
{
    public function index(Request $request)
    {
        return Role::where('tenant_id', $request->user()->tenant_id)
            ->with('permissions')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'            => 'required|string',
            'permissionCodes' => 'array',
        ]);

        $tenantId = $request->user()->tenant_id;

        return DB::transaction(function () use ($request, $tenantId) {
            $role = Role::create([
                'id'        => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id' => $tenantId,
                'name'      => $request->name,
            ]);

            if ($request->has('permissionCodes')) {
                $perms = Permission::whereIn('code', $request->permissionCodes)->get();
                foreach ($perms as $perm) {
                    DB::table('role_permissions')->insert([
                        'role_id'       => $role->id,
                        'permission_id' => $perm->id,
                    ]);
                }
            }

            return $role->load('permissions');
        });
    }

    public function show(Request $request, string $id)
    {
        $role = Role::with('permissions')
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$role) throw new NotFoundException("Role {$id} not found.");
        return $role;
    }

    public function update(Request $request, string $id)
    {
        $role = Role::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$role) throw new NotFoundException("Role {$id} not found.");
        if ($role->is_system_role) throw new ForbiddenException('System roles cannot be modified.');

        return DB::transaction(function () use ($request, $role) {
            if ($request->has('name')) $role->update(['name' => $request->name]);

            if ($request->has('permissionCodes')) {
                DB::table('role_permissions')->where('role_id', $role->id)->delete();
                $perms = Permission::whereIn('code', $request->permissionCodes)->get();
                foreach ($perms as $perm) {
                    DB::table('role_permissions')->insert([
                        'role_id'       => $role->id,
                        'permission_id' => $perm->id,
                    ]);
                }
            }

            return $role->fresh(['permissions']);
        });
    }

    public function destroy(Request $request, string $id)
    {
        $role = Role::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$role) throw new NotFoundException("Role {$id} not found.");
        if ($role->is_system_role) throw new ForbiddenException('System roles cannot be deleted.');
        $role->delete();
        return response()->json(['message' => 'Role deleted.']);
    }

    public function permissions()
    {
        return Permission::orderBy('module')->orderBy('code')->get();
    }
}
