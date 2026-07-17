<?php
// Upload this file to: public_html/posvan/clear_cache.php
// Access via: https://posvan.taqaantech.com/clear_cache.php
// DELETE this file immediately after running!

header('Content-Type: text/plain');

$laravelRoot = __DIR__ . '/pos_api';

if (!file_exists($laravelRoot . '/vendor/autoload.php')) {
    echo "ERROR: pos_api/vendor/autoload.php not found.\n";
    echo "Files in " . __DIR__ . ":\n";
    foreach (scandir(__DIR__) as $f) echo "  $f\n";
    exit;
}

define('LARAVEL_START', microtime(true));
require $laravelRoot . '/vendor/autoload.php';
$app = require_once $laravelRoot . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

foreach (['route:clear', 'config:clear', 'cache:clear', 'view:clear'] as $cmd) {
    $code = $kernel->call($cmd);
    echo ($code === 0 ? 'OK' : 'FAIL') . ": php artisan $cmd\n";
}

echo "\nAll done. DELETE THIS FILE from the server now!\n";
