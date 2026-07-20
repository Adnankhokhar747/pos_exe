-- ============================================================
-- HR Module Extended Migration
-- Recruitment, Expense Claims, Benefits, Tax, EOSB
-- Run via phpMyAdmin AFTER hr_module.sql
-- ============================================================

-- 1. Enhance payslips with bonus/EOSB/tax/expense/benefits columns
ALTER TABLE `hr_payslips`
  ADD COLUMN IF NOT EXISTS `performance_bonus`      DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `overtime_pay`,
  ADD COLUMN IF NOT EXISTS `expense_reimbursement`  DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `performance_bonus`,
  ADD COLUMN IF NOT EXISTS `benefit_adjustments`    DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `expense_reimbursement`,
  ADD COLUMN IF NOT EXISTS `eosb_provision`         DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `benefit_adjustments`,
  ADD COLUMN IF NOT EXISTS `tax_amount`             DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `eosb_provision`;

-- 2. Recruitment Jobs
CREATE TABLE IF NOT EXISTS `hr_jobs` (
  `id`              CHAR(36)      NOT NULL,
  `tenant_id`       CHAR(36)      NOT NULL,
  `title`           VARCHAR(150)  NOT NULL,
  `department`      VARCHAR(100)  NULL,
  `description`     TEXT          NULL,
  `requirements`    TEXT          NULL,
  `positions_count` TINYINT       NOT NULL DEFAULT 1,
  `status`          ENUM('open','on_hold','closed') NOT NULL DEFAULT 'open',
  `deadline`        DATE          NULL,
  `created_by`      CHAR(36)      NULL,
  `created_at`      TIMESTAMP     NULL,
  `updated_at`      TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_jobs_tenant_idx`  (`tenant_id`),
  INDEX `hr_jobs_status_idx`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Job Applicants
CREATE TABLE IF NOT EXISTS `hr_applicants` (
  `id`                   CHAR(36)     NOT NULL,
  `tenant_id`            CHAR(36)     NOT NULL,
  `job_id`               CHAR(36)     NOT NULL,
  `name`                 VARCHAR(100) NOT NULL,
  `email`                VARCHAR(150) NULL,
  `phone`                VARCHAR(30)  NULL,
  `nationality`          VARCHAR(60)  NULL,
  `stage`                ENUM('applied','screening','interview','offer','hired','rejected') NOT NULL DEFAULT 'applied',
  `cv_notes`             TEXT         NULL COMMENT 'Link to CV or summary',
  `interview_date`       DATE         NULL,
  `offered_salary`       DECIMAL(14,2) NULL,
  `rejection_reason`     TEXT         NULL,
  `hired_employee_id`    CHAR(36)     NULL COMMENT 'Set when converted to employee',
  `notes`                TEXT         NULL,
  `created_at`           TIMESTAMP    NULL,
  `updated_at`           TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_applicants_job_idx`    (`job_id`),
  INDEX `hr_applicants_tenant_idx` (`tenant_id`),
  INDEX `hr_applicants_stage_idx`  (`stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Expense Claims (header)
CREATE TABLE IF NOT EXISTS `hr_expense_claims` (
  `id`           CHAR(36)       NOT NULL,
  `tenant_id`    CHAR(36)       NOT NULL,
  `employee_id`  CHAR(36)       NOT NULL,
  `period_month` TINYINT        NOT NULL,
  `period_year`  SMALLINT       NOT NULL,
  `description`  VARCHAR(255)   NULL,
  `total_amount` DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `status`       ENUM('draft','submitted','approved','rejected','paid') NOT NULL DEFAULT 'draft',
  `approved_by`  CHAR(36)       NULL,
  `approved_at`  DATETIME       NULL,
  `rejection_reason` TEXT       NULL,
  `notes`        TEXT           NULL,
  `created_at`   TIMESTAMP      NULL,
  `updated_at`   TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_expense_claims_tenant_idx`   (`tenant_id`),
  INDEX `hr_expense_claims_employee_idx` (`employee_id`),
  INDEX `hr_expense_claims_status_idx`   (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Expense Claim Items (lines)
CREATE TABLE IF NOT EXISTS `hr_expense_claim_items` (
  `id`            CHAR(36)       NOT NULL,
  `claim_id`      CHAR(36)       NOT NULL,
  `expense_date`  DATE           NOT NULL,
  `category`      VARCHAR(100)   NOT NULL COMMENT 'Travel, Meals, Accommodation, etc.',
  `description`   VARCHAR(255)   NULL,
  `amount`        DECIMAL(14,2)  NOT NULL,
  `receipt_ref`   VARCHAR(100)   NULL COMMENT 'Receipt number or reference',
  `created_at`    TIMESTAMP      NULL,
  `updated_at`    TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_expense_claim_items_claim_idx` (`claim_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Benefit Types (configured per tenant)
CREATE TABLE IF NOT EXISTS `hr_benefit_types` (
  `id`          CHAR(36)      NOT NULL,
  `tenant_id`   CHAR(36)      NOT NULL,
  `name`        VARCHAR(100)  NOT NULL COMMENT 'Health Insurance, Air Ticket, Housing, etc.',
  `description` TEXT          NULL,
  `is_taxable`  TINYINT(1)    NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`  TIMESTAMP     NULL,
  `updated_at`  TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_benefit_types_tenant_idx` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Employee Benefit Assignments
CREATE TABLE IF NOT EXISTS `hr_employee_benefits` (
  `id`              CHAR(36)       NOT NULL,
  `tenant_id`       CHAR(36)       NOT NULL,
  `employee_id`     CHAR(36)       NOT NULL,
  `benefit_type_id` CHAR(36)       NOT NULL,
  `amount`          DECIMAL(14,2)  NOT NULL DEFAULT 0 COMMENT 'Monthly value',
  `effective_from`  DATE           NOT NULL,
  `effective_to`    DATE           NULL COMMENT 'NULL = ongoing',
  `notes`           TEXT           NULL,
  `created_at`      TIMESTAMP      NULL,
  `updated_at`      TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_employee_benefits_employee_idx` (`employee_id`),
  INDEX `hr_employee_benefits_tenant_idx`   (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tenant Tax Settings
CREATE TABLE IF NOT EXISTS `hr_tax_settings` (
  `id`               CHAR(36)       NOT NULL,
  `tenant_id`        CHAR(36)       NOT NULL,
  `is_enabled`       TINYINT(1)     NOT NULL DEFAULT 0,
  `tax_rate_pct`     DECIMAL(5,2)   NOT NULL DEFAULT 0 COMMENT 'Flat rate percentage',
  `tax_free_amount`  DECIMAL(14,2)  NOT NULL DEFAULT 0 COMMENT 'Amount exempt from tax',
  `applies_to`       ENUM('basic','gross') NOT NULL DEFAULT 'gross',
  `notes`            TEXT           NULL,
  `created_at`       TIMESTAMP      NULL,
  `updated_at`       TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hr_tax_settings_tenant_unique` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. End of Service Benefit Records (EOSB / Gratuity)
CREATE TABLE IF NOT EXISTS `hr_end_of_service_records` (
  `id`                  CHAR(36)       NOT NULL,
  `tenant_id`           CHAR(36)       NOT NULL,
  `employee_id`         CHAR(36)       NOT NULL,
  `employee_name`       VARCHAR(100)   NOT NULL COMMENT 'Denormalized for historical record',
  `join_date`           DATE           NOT NULL,
  `end_date`            DATE           NOT NULL,
  `reason`              ENUM('resignation','termination','retirement','death','other') NOT NULL DEFAULT 'resignation',
  `basic_salary`        DECIMAL(14,2)  NOT NULL COMMENT 'Last drawn basic',
  `years_of_service`    DECIMAL(5,2)   NOT NULL,
  `qualifying_years`    DECIMAL(5,2)   NOT NULL COMMENT 'Years that qualify for EOSB',
  `eosb_amount`         DECIMAL(14,2)  NOT NULL,
  `calculation_notes`   TEXT           NULL,
  `approved_by`         CHAR(36)       NULL,
  `created_at`          TIMESTAMP      NULL,
  `updated_at`          TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_eos_tenant_idx`   (`tenant_id`),
  INDEX `hr_eos_employee_idx` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Add new permissions
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.recruitment.manage', 'Create and manage job postings and applicant pipeline'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.recruitment.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.expense.manage', 'Approve and manage employee expense claims'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.expense.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.benefits.manage', 'Manage benefit types, employee benefits, tax settings, and EOSB'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.benefits.manage');

-- 11. Grant new permissions to existing Company Admin roles
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Company Admin'
  AND r.is_system_role = 1
  AND p.code IN ('hr.recruitment.manage','hr.expense.manage','hr.benefits.manage')
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 12. Grant new permissions to existing HR Manager roles
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'HR Manager'
  AND r.is_system_role = 1
  AND p.code IN ('hr.recruitment.manage','hr.expense.manage','hr.benefits.manage')
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Done. No data migration needed — new columns default to 0.
