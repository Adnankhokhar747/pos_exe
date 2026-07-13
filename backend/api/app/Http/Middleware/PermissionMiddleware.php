<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Exceptions\ForbiddenException;

class PermissionMiddleware
{
    public function handle(Request $request, Closure $next, string $permissionCode)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        if (!$user->hasPermission($permissionCode)) {
            throw new ForbiddenException("Missing required permission: {$permissionCode}");
        }

        return $next($request);
    }
}
