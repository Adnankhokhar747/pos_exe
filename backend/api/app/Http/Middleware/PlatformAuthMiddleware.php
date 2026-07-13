<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\PlatformAdmin;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class PlatformAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['error' => 'unauthenticated', 'message' => 'Platform token required.'], 401);
        }

        try {
            $secret = config('services.platform_jwt_secret', env('PLATFORM_JWT_SECRET'));
            $payload = JWT::decode($token, new Key($secret, 'HS256'));
            $admin = PlatformAdmin::find($payload->sub);
            if (!$admin) {
                return response()->json(['error' => 'unauthenticated', 'message' => 'Admin not found.'], 401);
            }
            $request->merge(['platformAdmin' => $admin]);
            $request->attributes->set('platformAdmin', $admin);
        } catch (Exception $e) {
            return response()->json(['error' => 'unauthenticated', 'message' => 'Invalid platform token.'], 401);
        }

        return $next($request);
    }
}
