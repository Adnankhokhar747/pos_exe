<?php
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$tenantId = \Illuminate\Support\Facades\DB::table("tenants")->where("name","Demo Company")->value("id");
$moduleId = \Illuminate\Support\Facades\DB::table("module_catalog")->where("code","hospital")->value("id");
\Illuminate\Support\Facades\DB::table("tenant_modules")->updateOrInsert(
    ["tenant_id" => $tenantId, "module_id" => $moduleId],
    ["id" => (string)\Illuminate\Support\Str::uuid(), "enabled" => true, "start_date" => now(), "expiry_date" => now()->addYears(10), "grace_period_days" => 7, "created_at" => now(), "updated_at" => now()]
);
echo "Hospital module enabled for tenant: " . $tenantId . "\n";
