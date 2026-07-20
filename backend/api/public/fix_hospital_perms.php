<?php
/**
 * Hospital Permission + Module Fixer — Direct PDO (no Laravel bootstrap needed)
 * -----------------------------------------------------------------------
 * UPLOAD to: public_html/posvan/fix_hospital_perms.php
 * OPEN in browser: https://posvan.taqaantech.com/fix_hospital_perms.php
 * READ the output — it shows exactly what's in the DB and what was fixed
 * DELETE immediately after: rm public_html/posvan/fix_hospital_perms.php
 * -----------------------------------------------------------------------
 * Fixes TWO sources of 403 on hospital.* routes:
 *   1. permission:hospital.lab.manage  → grants hospital.* to ALL roles
 *   2. module:hospital middleware       → inserts/enables hospital in module_catalog + tenant_modules
 */

header('Content-Type: text/plain; charset=utf-8');
echo "=== Hospital Permission + Module Fixer ===\n\n";

// ── Find and parse .env ─────────────────────────────────────────────────────
function findEnv(): array {
    $candidates = [
        __DIR__ . '/../../pos_api/.env',
        __DIR__ . '/../.env',
        __DIR__ . '/../../.env',
        __DIR__ . '/../../../pos_api/.env',
        __DIR__ . '/../../../.env',
    ];
    foreach ($candidates as $path) {
        if (file_exists($path)) {
            echo "✓ Found .env at: " . realpath($path) . "\n";
            $vars = [];
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
                [$k, $v] = explode('=', $line, 2);
                $vars[trim($k)] = trim(trim($v), '"\'');
            }
            return $vars;
        }
    }
    echo "WARNING: .env not found — using hardcoded fallback credentials.\n";
    return [];
}

$env = findEnv();
$dbHost = $env['DB_HOST']     ?? 'sdb-68.hosting.stackcp.net';
$dbName = $env['DB_DATABASE'] ?? 'posvan-3530343995b9';
$dbUser = $env['DB_USERNAME'] ?? 'posvan';
$dbPass = $env['DB_PASSWORD'] ?? 'POSVAN@123!';
$dbPort = $env['DB_PORT']     ?? '3306';
echo "DB: $dbUser@$dbHost:$dbPort/$dbName\n\n";

// ── Connect ─────────────────────────────────────────────────────────────────
try {
    $pdo = new PDO(
        "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4",
        $dbUser, $dbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    echo "✓ DB connected\n\n";
} catch (Exception $e) {
    die("DB CONNECTION FAILED: " . $e->getMessage() . "\n");
}

// helper
function uuid(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),
        mt_rand(0,0x0fff)|0x4000, mt_rand(0,0x3fff)|0x8000,
        mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
}

// ═══════════════════════════════════════════════════════════════════════════
// PART A — PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════
echo "════ PART A: PERMISSIONS ════\n\n";

// Show users + roles
echo "--- Users and their roles ---\n";
$rows = $pdo->query("
    SELECT u.email, u.name as uname, r.name as role, r.id as rid
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ORDER BY u.email
")->fetchAll();
foreach ($rows as $r) {
    echo "  {$r['email']} → " . ($r['role'] ?? 'NO ROLE') . "\n";
}
echo "\n";

// Show current hospital perms
echo "--- Current hospital.* permissions ---\n";
$existing = $pdo->query("SELECT code FROM permissions WHERE code LIKE 'hospital.%' ORDER BY code")->fetchAll();
foreach ($existing as $p) echo "  {$p['code']}\n";
if (empty($existing)) echo "  (none)\n";
echo "\n";

// Insert missing permissions
echo "--- Inserting missing permissions ---\n";
$needed = [
    ['hospital.lab.manage',         'hospital', 'Manage lab test catalog and create lab orders'],
    ['hospital.lab.results',        'hospital', 'Enter and verify lab test results'],
    ['hospital.patient.manage',     'hospital', 'Create and edit patient records'],
    ['hospital.doctor.manage',      'hospital', 'Create, edit, and manage doctor profiles'],
    ['hospital.appointment.manage', 'hospital', 'Create and transition appointments'],
    ['hospital.appointment.viewAll','hospital', "View every doctor's appointments"],
    ['hospital.report.view',        'hospital', 'View hospital and doctor reports'],
];
foreach ($needed as [$code, $module, $desc]) {
    try {
        $exists = $pdo->query("SELECT COUNT(*) FROM permissions WHERE code = " . $pdo->quote($code))->fetchColumn();
        if (!$exists) {
            $id = uuid();
            $pdo->prepare("INSERT INTO permissions (id, code, module, description) VALUES (?, ?, ?, ?)")
                ->execute([$id, $code, $module, $desc]);
            echo "  INSERTED: $code\n";
        } else {
            echo "  exists:   $code\n";
        }
    } catch (Exception $e) {
        echo "  ERROR ($code): " . $e->getMessage() . "\n";
    }
}
echo "\n";

// Load all hospital perm IDs
$hospPerms = $pdo->query("SELECT id, code FROM permissions WHERE code LIKE 'hospital.%'")->fetchAll();
echo count($hospPerms) . " hospital.* permissions in DB\n\n";

// Show all roles
echo "--- All roles ---\n";
$allRoles = $pdo->query("SELECT id, name FROM roles ORDER BY name")->fetchAll();
foreach ($allRoles as $r) echo "  {$r['name']}\n";
echo "\n";

// Grant ALL hospital.* to EVERY role
echo "--- Granting hospital.* to ALL roles ---\n";
$grant = $pdo->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
$totalGranted = 0;
foreach ($allRoles as $role) {
    $n = 0;
    foreach ($hospPerms as $perm) {
        try {
            $grant->execute([$role['id'], $perm['id']]);
            if ($grant->rowCount() > 0) { $n++; $totalGranted++; }
        } catch (Exception $e) {
            echo "  ERROR ({$role['name']} + {$perm['code']}): " . $e->getMessage() . "\n";
        }
    }
    echo "  {$role['name']}: " . ($n > 0 ? "+$n new grants" : "already complete") . "\n";
}
echo "  Total new grants: $totalGranted\n\n";

// ═══════════════════════════════════════════════════════════════════════════
// PART B — MODULE CATALOG + TENANT MODULES
// ═══════════════════════════════════════════════════════════════════════════
echo "════ PART B: MODULE CATALOG + TENANT MODULES ════\n\n";

// Check if module_catalog table exists
try {
    $pdo->query("SELECT 1 FROM module_catalog LIMIT 1");
    $hasCatalog = true;
    echo "✓ module_catalog table exists\n";
} catch (Exception $e) {
    $hasCatalog = false;
    echo "✗ module_catalog table NOT found — creating it...\n";
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS module_catalog (
                id          VARCHAR(36)  NOT NULL PRIMARY KEY,
                code        VARCHAR(100) NOT NULL UNIQUE,
                name        VARCHAR(255) NOT NULL,
                description TEXT         NULL,
                is_active   TINYINT(1)   NOT NULL DEFAULT 1,
                created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        echo "  ✓ Created module_catalog\n";
        $hasCatalog = true;
    } catch (Exception $e2) {
        echo "  ✗ Could not create: " . $e2->getMessage() . "\n";
    }
}

if ($hasCatalog) {
    // Ensure hospital row in module_catalog
    $catRow = $pdo->query("SELECT id, is_active FROM module_catalog WHERE code = 'hospital'")->fetch();
    if (!$catRow) {
        $catId = uuid();
        $pdo->prepare("INSERT INTO module_catalog (id, code, name, description, is_active) VALUES (?, 'hospital', 'Hospital / Doctor Management', 'Hospital module: doctors, patients, appointments, lab, pharmacy', 1)")
            ->execute([$catId]);
        echo "INSERTED: module_catalog row for 'hospital' (id=$catId)\n";
        $catRow = ['id' => $catId, 'is_active' => 1];
    } else {
        if (!$catRow['is_active']) {
            $pdo->prepare("UPDATE module_catalog SET is_active = 1 WHERE code = 'hospital'")->execute();
            echo "ACTIVATED: module_catalog hospital (was inactive)\n";
        } else {
            echo "OK: module_catalog 'hospital' exists and is_active=1\n";
        }
    }

    $catalogId = $catRow['id'] ?? $pdo->query("SELECT id FROM module_catalog WHERE code='hospital'")->fetchColumn();
    echo "  catalog id = $catalogId\n\n";

    // Check tenant_modules table
    try {
        $pdo->query("SELECT 1 FROM tenant_modules LIMIT 1");
        $hasTenantModules = true;
        echo "✓ tenant_modules table exists\n";
    } catch (Exception $e) {
        $hasTenantModules = false;
        echo "✗ tenant_modules table NOT found — creating it...\n";
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS tenant_modules (
                    id                VARCHAR(36)  NOT NULL PRIMARY KEY,
                    tenant_id         VARCHAR(36)  NOT NULL,
                    module_id         VARCHAR(36)  NOT NULL,
                    enabled           TINYINT(1)   NOT NULL DEFAULT 1,
                    start_date        TIMESTAMP    NULL,
                    expiry_date       TIMESTAMP    NULL,
                    grace_period_days INT          NOT NULL DEFAULT 7,
                    limits            JSON         NULL,
                    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_tenant_module (tenant_id, module_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            echo "  ✓ Created tenant_modules\n";
            $hasTenantModules = true;
        } catch (Exception $e2) {
            echo "  ✗ Could not create: " . $e2->getMessage() . "\n";
        }
    }

    if ($hasTenantModules) {
        // Get all tenants
        $tenants = $pdo->query("SELECT id, name FROM tenants ORDER BY name")->fetchAll();
        echo count($tenants) . " tenant(s) found\n";

        foreach ($tenants as $tenant) {
            $tm = $pdo->prepare("SELECT id, enabled FROM tenant_modules WHERE tenant_id = ? AND module_id = ?");
            $tm->execute([$tenant['id'], $catalogId]);
            $existing = $tm->fetch();

            if (!$existing) {
                $tmId = uuid();
                $pdo->prepare("INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, start_date, expiry_date, grace_period_days) VALUES (?, ?, ?, 1, NOW(), NULL, 365)")
                    ->execute([$tmId, $tenant['id'], $catalogId]);
                echo "  ENABLED hospital module for tenant: {$tenant['name']}\n";
            } elseif (!$existing['enabled']) {
                $pdo->prepare("UPDATE tenant_modules SET enabled = 1, expiry_date = NULL WHERE id = ?")
                    ->execute([$existing['id']]);
                echo "  RE-ENABLED hospital module for tenant: {$tenant['name']}\n";
            } else {
                echo "  OK: hospital already enabled for tenant: {$tenant['name']}\n";
            }
        }
    }
}
echo "\n";

// ═══════════════════════════════════════════════════════════════════════════
// FINAL VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════
echo "════ FINAL VERIFICATION ════\n\n";

echo "--- User → Role → hospital.lab.manage ---\n";
$check = $pdo->query("
    SELECT u.email, r.name as role_name, p.code
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.code = 'hospital.lab.manage'
    ORDER BY u.email
")->fetchAll();

if (empty($check)) {
    echo "  !! STILL NO RESULTS for hospital.lab.manage\n";
    echo "  Check: SELECT * FROM user_roles; — may be empty!\n";
} else {
    foreach ($check as $row) {
        echo "  ✓ {$row['email']} (via role: {$row['role_name']}) has hospital.lab.manage\n";
    }
}
echo "\n";

if ($hasCatalog && $hasTenantModules ?? false) {
    echo "--- tenant_modules state ---\n";
    $state = $pdo->query("
        SELECT t.name as tenant, mc.code as module, tm.enabled
        FROM tenant_modules tm
        JOIN tenants t ON t.id = tm.tenant_id
        JOIN module_catalog mc ON mc.id = tm.module_id
        WHERE mc.code = 'hospital'
    ")->fetchAll();
    foreach ($state as $s) {
        echo "  " . ($s['enabled'] ? '✓' : '✗') . " {$s['tenant']} — hospital module enabled=" . ($s['enabled'] ? 'YES' : 'NO') . "\n";
    }
    echo "\n";
}

echo "════════════════════════════════════════\n";
echo "DONE.\n\n";
echo "After running this:\n";
echo "  1. Log OUT of the app completely\n";
echo "  2. Log back IN (fresh JWT token picks up new permissions)\n";
echo "  3. Try the Lab Test / Lab Order pages again\n";
echo "  4. If still 403, paste the output above for further diagnosis\n";
echo "\nDELETE THIS FILE: rm public_html/posvan/fix_hospital_perms.php\n";
