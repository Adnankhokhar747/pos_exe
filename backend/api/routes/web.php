<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn() => response()->json(['service' => 'POS API', 'status' => 'ok']));

// ─── Admin Portal SPA ─────────────────────────────────────────────────────────
// Serve the built admin-portal at /admin and /admin/{any}.
// Build: VITE_ADMIN_BASE=/admin/ VITE_API_BASE_URL=https://yourserver.com npm run build
// Then copy apps/admin-portal/dist/* into backend/api/public/admin/
Route::get('/admin', function () {
    $file = public_path('admin/index.html');
    if (!file_exists($file)) {
        return response()->json(['error' => 'Admin portal not deployed. Run the build script first.'], 404);
    }
    return response()->file($file);
});

Route::get('/admin/{any}', function () {
    $file = public_path('admin/index.html');
    if (!file_exists($file)) {
        return response()->json(['error' => 'Admin portal not deployed. Run the build script first.'], 404);
    }
    return response()->file($file);
})->where('any', '.*');
