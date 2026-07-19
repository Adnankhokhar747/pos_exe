<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use App\Exceptions\UnauthorizedException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)
            ->where('status', 'active')
            ->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            throw new UnauthorizedException('Invalid credentials.');
        }

        $token = JWTAuth::fromUser($user);
        $permissions = $user->getPermissions();
        [$branchId, $branchName, $warehouseId] = $this->resolveBranchWarehouse($user->tenant_id);

        return response()->json([
            'accessToken' => $token,
            'user' => [
                'id'          => $user->id,
                'tenantId'    => $user->tenant_id,
                'username'    => $user->username,
                'fullName'    => $user->full_name,
                'permissions' => $permissions,
                'branchId'    => $branchId,
                'branchName'  => $branchName,
                'warehouseId' => $warehouseId,
            ],
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $permissions = $user->getPermissions();
        [$branchId, $branchName, $warehouseId] = $this->resolveBranchWarehouse($user->tenant_id);

        return response()->json([
            'id'          => $user->id,
            'tenantId'    => $user->tenant_id,
            'username'    => $user->username,
            'fullName'    => $user->full_name,
            'permissions' => $permissions,
            'branchId'    => $branchId,
            'branchName'  => $branchName,
            'warehouseId' => $warehouseId,
        ]);
    }

    public function refresh()
    {
        try {
            $token = JWTAuth::parseToken()->refresh();
            return response()->json(['accessToken' => $token]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'unauthenticated', 'message' => 'Could not refresh token.'], 401);
        }
    }

    public function logout()
    {
        JWTAuth::parseToken()->invalidate();
        return response()->json(['message' => 'Logged out.']);
    }

    public function updateProfile(Request $request)
    {
        $request->validate([
            'fullName'    => 'nullable|string|max:255',
            'currentPassword' => 'nullable|string',
            'newPassword'     => 'nullable|string|min:6',
        ]);

        $user = $request->user();

        if ($request->filled('newPassword')) {
            if (!$request->filled('currentPassword') || !Hash::check($request->currentPassword, $user->password_hash)) {
                return response()->json(['message' => 'Current password is incorrect.'], 422);
            }
            $user->password_hash = Hash::make($request->newPassword);
        }

        if ($request->filled('fullName')) {
            $user->full_name = $request->fullName;
        }

        $user->save();

        $permissions = $user->getPermissions();
        [$branchId, $branchName, $warehouseId] = $this->resolveBranchWarehouse($user->tenant_id);

        return response()->json([
            'id'          => $user->id,
            'tenantId'    => $user->tenant_id,
            'username'    => $user->username,
            'fullName'    => $user->full_name,
            'permissions' => $permissions,
            'branchId'    => $branchId,
            'branchName'  => $branchName,
            'warehouseId' => $warehouseId,
        ]);
    }

    private function resolveBranchWarehouse(string $tenantId): array
    {
        $branch = DB::table('branches')
            ->where('tenant_id', $tenantId)
            ->orderBy('created_at')
            ->first();

        if (!$branch) {
            return [null, null, null];
        }

        $warehouse = DB::table('warehouses')
            ->where('branch_id', $branch->id)
            ->orderByDesc('is_default')
            ->first();

        return [$branch->id, $branch->name, $warehouse?->id];
    }
}
