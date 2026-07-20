<?php
/**
 * ONE-TIME permission fix for hospital.lab.manage + hospital.lab.results
 * -----------------------------------------------------------------------
 * 1. Upload THIS file to: public_html/posvan/fix_lab_perms.php
 * 2. Open in browser:  https://posvan.taqaantech.com/fix_lab_perms.php
 * 3. READ the output — it shows before/after state
 * 4. DELETE this file immediately after (it exposes nothing but run it only once)
 */

define('LARAVEL_START', microtime(true));
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

header('Content-Type: text/plain; charset=utf-8');

echo "=== Hospital Lab Permission Fixer ===\n\n";

// ── Step 1: Show existing hospital permissions ─────────────────────────────
$existing = DB::table('permissions')
    ->where('code', 'like', 'hospital.%')
    ->pluck('code')
    ->toArray();

echo "EXISTING hospital.* permissions in DB:\n";
foreach ($existing as $c) echo "  ✓ $c\n";
if (empty($existing)) echo "  (none found)\n";
echo "\n";

// ── Step 2: Insert missing permissions ────────────────────────────────────
$needed = [
    ['code' => 'hospital.lab.manage',         'module' => 'hospital', 'description' => 'Manage lab test catalog and create lab orders'],
    ['code' => 'hospital.lab.results',         'module' => 'hospital', 'description' => 'Enter and verify lab test results'],
    ['code' => 'hospital.patient.manage',      'module' => 'hospital', 'description' => 'Create and edit patient records'],
    ['code' => 'hospital.doctor.manage',       'module' => 'hospital', 'description' => 'Create, edit, and manage doctor profiles and schedules'],
    ['code' => 'hospital.appointment.manage',  'module' => 'hospital', 'description' => 'Create, update, and transition appointments'],
    ['code' => 'hospital.appointment.viewAll', 'module' => 'hospital', 'description' => "View every doctor's appointments"],
    ['code' => 'hospital.report.view',         'module' => 'hospital', 'description' => 'View hospital and doctor reports'],
];

echo "INSERTING missing permissions:\n";
foreach ($needed as $p) {
    $exists = DB::table('permissions')->where('code', $p['code'])->exists();
    if (!$exists) {
        DB::table('permissions')->insert([
            'id'          => (string) Str::uuid(),
            'code'        => $p['code'],
            'module'      => $p['module'],
            'description' => $p['description'],
        ]);
        echo "  INSERTED: {$p['code']}\n";
    } else {
        echo "  already exists: {$p['code']}\n";
    }
}
echo "\n";

// ── Step 3: Grant ALL hospital.* to Company Admin ─────────────────────────
$allHospitalPerms = DB::table('permissions')
    ->where('code', 'like', 'hospital.%')
    ->get(['id', 'code']);

$companyAdminRoles = DB::table('roles')
    ->where('name', 'Company Admin')
    ->get(['id', 'name', 'tenant_id']);

echo "GRANTING to Company Admin roles (" . count($companyAdminRoles) . " tenants):\n";
$granted = 0;
foreach ($companyAdminRoles as $role) {
    foreach ($allHospitalPerms as $perm) {
        $exists = DB::table('role_permissions')
            ->where('role_id', $role->id)
            ->where('permission_id', $perm->id)
            ->exists();
        if (!$exists) {
            DB::table('role_permissions')->insert([
                'role_id'       => $role->id,
                'permission_id' => $perm->id,
            ]);
            $granted++;
        }
    }
}
echo "  Granted $granted new role_permissions rows\n\n";

// ── Step 4: Grant to Hospital Manager ────────────────────────────────────
$hmRoles = DB::table('roles')->where('name', 'Hospital Manager')->get(['id']);
$hmCodes = ['hospital.lab.manage','hospital.lab.results','hospital.patient.manage',
            'hospital.doctor.manage','hospital.appointment.manage',
            'hospital.appointment.viewAll','hospital.report.view'];
$hmPerms = DB::table('permissions')->whereIn('code', $hmCodes)->get(['id','code']);

echo "GRANTING to Hospital Manager roles (" . count($hmRoles) . " tenants):\n";
$hm_granted = 0;
foreach ($hmRoles as $role) {
    foreach ($hmPerms as $perm) {
        $exists = DB::table('role_permissions')
            ->where('role_id', $role->id)
            ->where('permission_id', $perm->id)
            ->exists();
        if (!$exists) {
            DB::table('role_permissions')->insert([
                'role_id'       => $role->id,
                'permission_id' => $perm->id,
            ]);
            $hm_granted++;
        }
    }
}
echo "  Granted $hm_granted new rows\n\n";

// ── Step 5: Final verification ────────────────────────────────────────────
echo "FINAL STATE — permissions per role:\n";
$final = DB::table('roles as r')
    ->join('role_permissions as rp', 'rp.role_id', '=', 'r.id')
    ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
    ->where('p.code', 'like', 'hospital.%')
    ->whereIn('r.name', ['Company Admin', 'Hospital Manager', 'Receptionist', 'Doctor'])
    ->select('r.name', 'p.code')
    ->orderBy('r.name')
    ->orderBy('p.code')
    ->get();

$byRole = [];
foreach ($final as $row) {
    $byRole[$row->name][] = $row->code;
}
foreach ($byRole as $role => $perms) {
    echo "\n  [$role]\n";
    foreach ($perms as $p) echo "    ✓ $p\n";
}

echo "\n\n=== DONE — DELETE THIS FILE NOW ===\n";
echo "Run: rm public_html/posvan/fix_lab_perms.php\n";
