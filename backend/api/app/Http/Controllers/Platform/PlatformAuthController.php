<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\PlatformAdmin;
use Illuminate\Support\Facades\Hash;
use Firebase\JWT\JWT;
use App\Exceptions\UnauthorizedException;

class PlatformAuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $admin = PlatformAdmin::where('username', $request->username)->first();
        if (!$admin || !Hash::check($request->password, $admin->password_hash)) {
            throw new UnauthorizedException('Invalid platform credentials.');
        }

        $secret = config('jwt.platform_secret');
        $ttl = config('jwt.platform_ttl', 1440);
        $payload = [
            'sub' => $admin->id,
            'iat' => time(),
            'exp' => time() + $ttl * 60,
            'nbf' => time(),
            'jti' => uniqid('platform_', true),
            'iss' => config('app.url'),
        ];
        $token = JWT::encode($payload, $secret, 'HS256');

        return response()->json([
            'accessToken' => $token,
            'admin' => [
                'id'       => $admin->id,
                'username' => $admin->username,
                'fullName' => $admin->full_name,
                'email'    => $admin->email,
            ],
        ]);
    }

    public function me(Request $request)
    {
        $admin = $request->attributes->get('platformAdmin');
        return response()->json([
            'id'       => $admin->id,
            'username' => $admin->username,
            'fullName' => $admin->full_name,
            'email'    => $admin->email,
        ]);
    }
}
