<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;
use App\Exceptions\UnauthorizedException;

class JwtAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        try {
            $user = JWTAuth::parseToken()->authenticate();
            if (!$user) {
                throw new UnauthorizedException('User not found.');
            }
            $request->setUserResolver(fn() => $user);
        } catch (JWTException $e) {
            return response()->json(['error' => 'unauthenticated', 'message' => 'Token is invalid or expired.'], 401);
        }

        return $next($request);
    }
}
