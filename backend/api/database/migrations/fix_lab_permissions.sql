-- ============================================================
-- FIX: Lab + Hospital Permissions
-- Run this in phpMyAdmin if you already ran lab_pharmacy_module.sql
-- (that file used wrong permission codes — this corrects them)
-- ============================================================

-- 1. Insert correct lab permission codes (routes use hospital.lab.*)
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.lab.manage', 'Manage lab test catalog and create lab orders'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.lab.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.lab.results', 'Enter and verify lab test results'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.lab.results');

-- 2. Ensure all hospital permissions exist (in case PHP seeder was not run)
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.doctor.manage', 'Create, edit, and manage doctor profiles and schedules'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.doctor.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.patient.manage', 'Create and edit patient records'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.patient.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.appointment.manage', 'Create, update, and transition appointments and issue tokens'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.appointment.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.appointment.viewAll', 'View every doctor''s appointments and queue'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.appointment.viewAll');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.report.view', 'View hospital and doctor reports'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.report.view');

-- 3. Grant ALL hospital permissions to Company Admin
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.name = 'Company Admin'
  AND r.is_system_role = 1
  AND p.code IN (
    'hospital.lab.manage',
    'hospital.lab.results',
    'hospital.doctor.manage',
    'hospital.patient.manage',
    'hospital.appointment.manage',
    'hospital.appointment.viewAll',
    'hospital.report.view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 4. Grant hospital + lab permissions to Hospital Manager
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.name = 'Hospital Manager'
  AND r.is_system_role = 1
  AND p.code IN (
    'hospital.lab.manage',
    'hospital.lab.results',
    'hospital.doctor.manage',
    'hospital.patient.manage',
    'hospital.appointment.manage',
    'hospital.appointment.viewAll',
    'hospital.report.view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 5. Grant core hospital permissions to Receptionist
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.name = 'Receptionist'
  AND r.is_system_role = 1
  AND p.code IN (
    'hospital.patient.manage',
    'hospital.appointment.manage',
    'hospital.appointment.viewAll'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Done. Refresh your browser to pick up the new permissions.
