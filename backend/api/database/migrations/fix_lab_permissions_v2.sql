-- ============================================================
-- FIX v2: Lab + Hospital Permissions
-- The `permissions` table has a NOT NULL `module` column —
-- previous scripts were missing it, causing silent INSERT failures.
-- ============================================================

-- Step 1: Remove any wrong-code rows from the original migration
DELETE FROM `permissions`
WHERE `code` IN ('lab.test.manage','lab.order.manage','lab.result.enter','lab.report.view');

-- Step 2: Insert correct permissions (with `module` column — required NOT NULL)
INSERT INTO `permissions` (`id`, `code`, `module`, `description`)
SELECT UUID(), 'hospital.lab.manage', 'hospital', 'Manage lab test catalog and create lab orders'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.lab.manage');

INSERT INTO `permissions` (`id`, `code`, `module`, `description`)
SELECT UUID(), 'hospital.lab.results', 'hospital', 'Enter and verify lab test results'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.lab.results');

INSERT INTO `permissions` (`id`, `code`, `module`, `description`)
SELECT UUID(), 'hospital.patient.manage', 'hospital', 'Create and edit patient records'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.patient.manage');

INSERT INTO `permissions` (`id`, `code`, `module`, `description`)
SELECT UUID(), 'hospital.doctor.manage', 'hospital', 'Create, edit, and manage doctor profiles and schedules'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.doctor.manage');

INSERT INTO `permissions` (`id`, `code`, `module`, `description`)
SELECT UUID(), 'hospital.appointment.manage', 'hospital', 'Create, update, and transition appointments and issue tokens'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.appointment.manage');

INSERT INTO `permissions` (`id`, `code`, `module`, `description`)
SELECT UUID(), 'hospital.appointment.viewAll', 'hospital', 'View every doctor''s appointments and queue'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.appointment.viewAll');

INSERT INTO `permissions` (`id`, `code`, `module`, `description`)
SELECT UUID(), 'hospital.report.view', 'hospital', 'View hospital and doctor reports'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.report.view');

-- Step 3: Grant ALL hospital.* permissions to Company Admin (every tenant)
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Company Admin'
  AND p.code LIKE 'hospital.%'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` x
    WHERE x.role_id = r.id AND x.permission_id = p.id
  );

-- Step 4: Grant lab permissions to Hospital Manager (every tenant)
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Hospital Manager'
  AND p.code IN ('hospital.lab.manage','hospital.lab.results','hospital.patient.manage','hospital.appointment.manage','hospital.appointment.viewAll','hospital.report.view','hospital.doctor.manage')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` x
    WHERE x.role_id = r.id AND x.permission_id = p.id
  );

-- Step 5: Grant core permissions to Receptionist
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Receptionist'
  AND p.code IN ('hospital.patient.manage','hospital.appointment.manage','hospital.appointment.viewAll')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` x
    WHERE x.role_id = r.id AND x.permission_id = p.id
  );

-- Verify: run this SELECT to confirm the grants worked
SELECT r.name AS role_name, p.code AS permission
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.code LIKE 'hospital.%'
ORDER BY r.name, p.code;
