-- ============================================================
-- Lab Module + Pharmacy POS Mode Migration
-- Run via phpMyAdmin AFTER hospital module SQL
-- ============================================================

-- 1. Add pharmacy flag to categories table
ALTER TABLE `categories`
  ADD COLUMN IF NOT EXISTS `is_pharmacy` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Show in Pharmacy POS mode';

-- 2. Lab Test Catalog (per tenant)
CREATE TABLE IF NOT EXISTS `lab_tests` (
  `id`              CHAR(36)       NOT NULL,
  `tenant_id`       CHAR(36)       NOT NULL,
  `code`            VARCHAR(50)    NOT NULL COMMENT 'e.g. CBC, LFT, RBS',
  `name`            VARCHAR(150)   NOT NULL,
  `category`        VARCHAR(100)   NULL COMMENT 'Haematology, Biochemistry, Microbiology, etc.',
  `unit`            VARCHAR(50)    NULL COMMENT 'mg/dL, g/L, etc.',
  `normal_range`    VARCHAR(150)   NULL COMMENT 'e.g. 70-110 mg/dL',
  `price`           DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `turnaround_hrs`  TINYINT        NOT NULL DEFAULT 24 COMMENT 'Expected hours to result',
  `is_active`       TINYINT(1)     NOT NULL DEFAULT 1,
  `notes`           TEXT           NULL,
  `created_at`      TIMESTAMP      NULL,
  `updated_at`      TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lab_tests_tenant_code_unique` (`tenant_id`, `code`),
  INDEX `lab_tests_tenant_idx` (`tenant_id`),
  INDEX `lab_tests_category_idx` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Lab Orders (one per patient visit, contains many tests)
CREATE TABLE IF NOT EXISTS `lab_orders` (
  `id`              CHAR(36)       NOT NULL,
  `tenant_id`       CHAR(36)       NOT NULL,
  `order_number`    VARCHAR(30)    NOT NULL COMMENT 'Auto-generated e.g. LAB-0001',
  `patient_id`      CHAR(36)       NOT NULL,
  `appointment_id`  CHAR(36)       NULL COMMENT 'Optional link to appointment',
  `doctor_id`       CHAR(36)       NULL COMMENT 'Ordering doctor',
  `ordered_by`      CHAR(36)       NULL COMMENT 'Staff who created the order',
  `status`          ENUM('pending','sample_collected','processing','completed','cancelled')
                                   NOT NULL DEFAULT 'pending',
  `priority`        ENUM('routine','urgent','stat') NOT NULL DEFAULT 'routine',
  `total_amount`    DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `notes`           TEXT           NULL,
  `created_at`      TIMESTAMP      NULL,
  `updated_at`      TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lab_orders_number_tenant` (`tenant_id`, `order_number`),
  INDEX `lab_orders_tenant_idx`    (`tenant_id`),
  INDEX `lab_orders_patient_idx`   (`patient_id`),
  INDEX `lab_orders_status_idx`    (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Lab Order Items (individual tests within an order)
CREATE TABLE IF NOT EXISTS `lab_order_items` (
  `id`             CHAR(36)       NOT NULL,
  `order_id`       CHAR(36)       NOT NULL,
  `test_id`        CHAR(36)       NOT NULL,
  `test_code`      VARCHAR(50)    NOT NULL COMMENT 'Denormalized',
  `test_name`      VARCHAR(150)   NOT NULL COMMENT 'Denormalized',
  `unit`           VARCHAR(50)    NULL,
  `normal_range`   VARCHAR(150)   NULL,
  `price`          DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `status`         ENUM('pending','sample_collected','processing','resulted','verified')
                                   NOT NULL DEFAULT 'pending',
  `collected_at`   DATETIME       NULL,
  `resulted_at`    DATETIME       NULL,
  `verified_at`    DATETIME       NULL,
  `created_at`     TIMESTAMP      NULL,
  `updated_at`     TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `lab_order_items_order_idx` (`order_id`),
  INDEX `lab_order_items_test_idx`  (`test_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Lab Results (one row per order item)
CREATE TABLE IF NOT EXISTS `lab_results` (
  `id`            CHAR(36)       NOT NULL,
  `order_item_id` CHAR(36)       NOT NULL,
  `order_id`      CHAR(36)       NOT NULL COMMENT 'Denormalized for fast queries',
  `patient_id`    CHAR(36)       NOT NULL COMMENT 'Denormalized',
  `result_value`  VARCHAR(255)   NOT NULL,
  `result_flag`   ENUM('normal','low','high','critical_low','critical_high','abnormal','pending')
                                  NOT NULL DEFAULT 'normal',
  `remarks`       TEXT           NULL,
  `entered_by`    CHAR(36)       NULL,
  `verified_by`   CHAR(36)       NULL,
  `created_at`    TIMESTAMP      NULL,
  `updated_at`    TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lab_results_item_unique` (`order_item_id`),
  INDEX `lab_results_order_idx`   (`order_id`),
  INDEX `lab_results_patient_idx` (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Lab + Hospital permissions (correct codes matching routes)
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.lab.manage', 'Manage lab test catalog and create lab orders'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.lab.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hospital.lab.results', 'Enter and verify lab test results'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hospital.lab.results');

-- Ensure all hospital permissions exist (added by PHP seeder, but guarantee them here too)
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

-- 7. Grant ALL hospital permissions to Company Admin
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.name = 'Company Admin' AND r.is_system_role = 1
  AND p.code IN (
    'hospital.lab.manage','hospital.lab.results',
    'hospital.doctor.manage','hospital.patient.manage',
    'hospital.appointment.manage','hospital.appointment.viewAll','hospital.report.view'
  )
  AND NOT EXISTS (SELECT 1 FROM `role_permissions` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 8. Grant lab + full hospital permissions to Hospital Manager
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.name = 'Hospital Manager' AND r.is_system_role = 1
  AND p.code IN (
    'hospital.lab.manage','hospital.lab.results',
    'hospital.doctor.manage','hospital.patient.manage',
    'hospital.appointment.manage','hospital.appointment.viewAll','hospital.report.view'
  )
  AND NOT EXISTS (SELECT 1 FROM `role_permissions` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 9. Grant lab results permission to Receptionist
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.name = 'Receptionist' AND r.is_system_role = 1
  AND p.code IN ('hospital.lab.manage','hospital.patient.manage','hospital.appointment.manage','hospital.appointment.viewAll')
  AND NOT EXISTS (SELECT 1 FROM `role_permissions` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 10. New Lab Technician role (per tenant)
INSERT INTO `roles` (`id`, `tenant_id`, `name`, `is_system_role`)
SELECT UUID(), t.id, 'Lab Technician', 1
FROM `tenants` t
WHERE NOT EXISTS (SELECT 1 FROM `roles` r WHERE r.tenant_id = t.id AND r.name = 'Lab Technician');

-- Grant Lab Technician: lab manage + results
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.name = 'Lab Technician' AND r.is_system_role = 1
  AND p.code IN ('hospital.lab.manage','hospital.lab.results')
  AND NOT EXISTS (SELECT 1 FROM `role_permissions` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Done
