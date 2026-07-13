<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Role;
use App\Models\TenantSubscription;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\LimitExceededError;
use App\Exceptions\ForbiddenException;

class UsersController extends Controller
{
    public function index(Request $request)
    {
        return User::where('tenant_id', $request->user()->tenant_id)
            ->with('roles')
            ->when($request->search, fn($q, $s) =>
                $q->where(function($q) use ($s) {
                    $q->where('full_name', 'ilike', "%{$s}%")
                      ->orWhere('username', 'ilike', "%{$s}%");
                })
            )
            ->orderBy('full_name')
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'fullName' => 'required|string',
            'username' => 'required|string',
            'password' => 'required|string|min:6',
            'roleIds'  => 'array',
            'roleIds.*'=> 'uuid',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Check user limit
        $sub = TenantSubscription::with('plan')->where('tenant_id', $tenantId)->first();
        if ($sub && $sub->plan->user_limit !== null) {
            $count = User::where('tenant_id', $tenantId)->where('status', 'active')->count();
            if ($count >= $sub->plan->user_limit) {
                throw new LimitExceededError("User limit of {$sub->plan->user_limit} reached.");
            }
        }

        return DB::transaction(function () use ($request, $tenantId) {
            $user = User::create([
                'id'            => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'     => $tenantId,
                'full_name'     => $request->fullName,
                'username'      => $request->username,
                'email'         => $request->email,
                'password_hash' => Hash::make($request->password),
            ]);

            if ($request->has('roleIds') && count($request->roleIds)) {
                $roles = Role::where('tenant_id', $tenantId)
                    ->whereIn('id', $request->roleIds)
                    ->pluck('id');
                foreach ($roles as $roleId) {
                    DB::table('user_roles')->insert(['user_id' => $user->id, 'role_id' => $roleId]);
                }
            }

            return $user->load('roles');
        });
    }

    public function show(Request $request, string $id)
    {
        $user = User::with('roles')
            ->where('tenant_id', $request->user()->tenant_id)
            ->find($id);
        if (!$user) throw new NotFoundException("User {$id} not found.");
        return $user;
    }

    public function update(Request $request, string $id)
    {
        $user = User::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$user) throw new NotFoundException("User {$id} not found.");

        return DB::transaction(function () use ($request, $user) {
            $user->update(array_filter([
                'full_name' => $request->fullName,
                'email'     => $request->email,
                'status'    => $request->status,
            ], fn($v) => $v !== null));

            if ($request->has('roleIds')) {
                DB::table('user_roles')->where('user_id', $user->id)->delete();
                $roles = Role::where('tenant_id', $user->tenant_id)
                    ->whereIn('id', $request->roleIds)
                    ->pluck('id');
                foreach ($roles as $roleId) {
                    DB::table('user_roles')->insert(['user_id' => $user->id, 'role_id' => $roleId]);
                }
            }

            return $user->fresh(['roles']);
        });
    }

    public function changePassword(Request $request, string $id)
    {
        $request->validate(['newPassword' => 'required|string|min:6']);
        $me = $request->user();

        $user = User::where('tenant_id', $me->tenant_id)->find($id);
        if (!$user) throw new NotFoundException("User {$id} not found.");

        if ($user->id !== $me->id && !$me->hasPermission('identity.user.manage')) {
            throw new ForbiddenException('You can only change your own password.');
        }

        $user->update(['password_hash' => Hash::make($request->newPassword)]);
        return response()->json(['message' => 'Password updated.']);
    }
}
