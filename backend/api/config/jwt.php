<?php

return [
    'secret'          => env('JWT_SECRET'),
    'platform_secret' => env('PLATFORM_JWT_SECRET'),
    'platform_ttl'    => (int) env('PLATFORM_JWT_TTL', 1440),
    'keys'    => ['public' => null, 'private' => null, 'passphrase' => null],
    'ttl'     => env('JWT_TTL', 1440),
    'refresh_ttl' => env('JWT_REFRESH_TTL', 20160),
    'algo'    => env('JWT_ALGO', 'HS256'),
    'required_claims' => ['iss', 'iat', 'exp', 'nbf', 'sub', 'jti'],
    'persistent_claims' => [],
    'lock_subject' => true,
    'leeway'  => env('JWT_LEEWAY', 0),
    'blacklist_enabled' => env('JWT_BLACKLIST_ENABLED', true),
    'blacklist_grace_period' => env('JWT_BLACKLIST_GRACE_PERIOD', 0),
    'decrypt_cookies' => false,
    'providers' => [
        'jwt'     => PHPOpenSourceSaver\JWTAuth\Providers\JWT\Lcobucci::class,
        'auth'    => PHPOpenSourceSaver\JWTAuth\Providers\Auth\Illuminate::class,
        'storage' => PHPOpenSourceSaver\JWTAuth\Providers\Storage\Illuminate::class,
    ],
];
