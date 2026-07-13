<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use App\Exceptions\DomainException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            \App\Http\Middleware\CamelCaseResponse::class,
        ]);
        $middleware->alias([
            'jwt.auth'    => \App\Http\Middleware\JwtAuthMiddleware::class,
            'platform.auth' => \App\Http\Middleware\PlatformAuthMiddleware::class,
            'permission'  => \App\Http\Middleware\PermissionMiddleware::class,
            'module'      => \App\Http\Middleware\ModuleMiddleware::class,
            'license'     => \App\Http\Middleware\LicenseMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (DomainException $e, Request $request) {
            return response()->json([
                'error' => $e->getErrorCode(),
                'message' => $e->getMessage(),
            ], $e->getHttpStatus());
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            return response()->json(['error' => 'not_found', 'message' => 'Resource not found.'], 404);
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) {
            return response()->json(['error' => 'method_not_allowed', 'message' => 'Method not allowed.'], 405);
        });

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            return response()->json(['error' => 'unauthenticated', 'message' => 'Unauthenticated.'], 401);
        });

        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
            return response()->json([
                'error'   => 'validation_error',
                'message' => 'Validation failed.',
                'errors'  => $e->errors(),
            ], 422);
        });
    })->create();
