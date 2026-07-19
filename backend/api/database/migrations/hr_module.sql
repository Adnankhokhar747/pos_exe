-- ============================================================
-- HR / Attendance & Payroll Module Migration
-- Run via phpMyAdmin on the live database
-- ============================================================

-- 1. Employees
CREATE TABLE IF NOT EXISTS `hr_employees` (
  `id`                   CHAR(36)       NOT NULL,
  `tenant_id`            CHAR(36)       NOT NULL,
  `user_id`              CHAR(36)       NULL COMMENT 'Linked POS user (optional)',
  `employee_code`        VARCHAR(20)    NULL,
  `name`                 VARCHAR(100)   NOT NULL,
  `email`                VARCHAR(100)   NULL,
  `phone`                VARCHAR(20)    NULL,
  `department`           VARCHAR(100)   NULL,
  `job_title`            VARCHAR(100)   NULL,
  `join_date`            DATE           NULL,
  `shift_id`             CHAR(36)       NULL,
  `salary_type`          ENUM('monthly','daily','hourly') NOT NULL DEFAULT 'monthly',
  `basic_salary`         DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `housing_allowance`    DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `transport_allowance`  DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `other_allowances`     DECIMAL(14,2)  NOT NULL DEFAULT 0,
  `annual_leave_days`    INT            NOT NULL DEFAULT 21,
  `overtime_rate`        DECIMAL(5,2)   NOT NULL DEFAULT 1.50 COMMENT 'Multiplier for overtime pay',
  `is_active`            TINYINT(1)     NOT NULL DEFAULT 1,
  `notes`                TEXT           NULL,
  `created_at`           TIMESTAMP      NULL,
  `updated_at`           TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hr_employees_user_unique` (`user_id`),
  INDEX `hr_employees_tenant_idx` (`tenant_id`),
  INDEX `hr_employees_shift_idx` (`shift_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Shifts
CREATE TABLE IF NOT EXISTS `hr_shifts` (
  `id`             CHAR(36)      NOT NULL,
  `tenant_id`      CHAR(36)      NOT NULL,
  `name`           VARCHAR(100)  NOT NULL,
  `start_time`     TIME          NOT NULL,
  `end_time`       TIME          NOT NULL,
  `grace_minutes`  INT           NOT NULL DEFAULT 15 COMMENT 'Late arrival tolerance',
  `is_active`      TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`     TIMESTAMP     NULL,
  `updated_at`     TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_shifts_tenant_idx` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Daily attendance
CREATE TABLE IF NOT EXISTS `hr_attendance` (
  `id`               CHAR(36)     NOT NULL,
  `tenant_id`        CHAR(36)     NOT NULL,
  `employee_id`      CHAR(36)     NOT NULL,
  `work_date`        DATE         NOT NULL,
  `clock_in`         DATETIME     NULL,
  `clock_out`        DATETIME     NULL,
  `status`           ENUM('present','absent','late','half_day','on_leave') NOT NULL DEFAULT 'present',
  `work_minutes`     INT          NULL COMMENT 'Computed on clock-out',
  `overtime_minutes` INT          NOT NULL DEFAULT 0,
  `notes`            VARCHAR(255) NULL,
  `created_by`       CHAR(36)     NULL,
  `created_at`       TIMESTAMP    NULL,
  `updated_at`       TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hr_attendance_emp_date_unique` (`employee_id`, `work_date`),
  INDEX `hr_attendance_tenant_idx` (`tenant_id`),
  INDEX `hr_attendance_date_idx`   (`work_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Leave types
CREATE TABLE IF NOT EXISTS `hr_leave_types` (
  `id`            CHAR(36)      NOT NULL,
  `tenant_id`     CHAR(36)      NOT NULL,
  `name`          VARCHAR(100)  NOT NULL,
  `is_paid`       TINYINT(1)    NOT NULL DEFAULT 1,
  `days_per_year` INT           NULL COMMENT 'NULL = unlimited',
  `is_active`     TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP     NULL,
  `updated_at`    TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_leave_types_tenant_idx` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Leave requests
CREATE TABLE IF NOT EXISTS `hr_leaves` (
  `id`               CHAR(36)      NOT NULL,
  `tenant_id`        CHAR(36)      NOT NULL,
  `employee_id`      CHAR(36)      NOT NULL,
  `leave_type_id`    CHAR(36)      NOT NULL,
  `from_date`        DATE          NOT NULL,
  `to_date`          DATE          NOT NULL,
  `days`             INT           NOT NULL,
  `reason`           TEXT          NULL,
  `status`           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `approved_by`      CHAR(36)      NULL,
  `approved_at`      DATETIME      NULL,
  `rejection_reason` VARCHAR(255)  NULL,
  `created_by`       CHAR(36)      NULL,
  `created_at`       TIMESTAMP     NULL,
  `updated_at`       TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  INDEX `hr_leaves_tenant_idx`   (`tenant_id`),
  INDEX `hr_leaves_employee_idx` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Payroll runs (one per tenant per month)
CREATE TABLE IF NOT EXISTS `hr_payroll_runs` (
  `id`                CHAR(36)      NOT NULL,
  `tenant_id`         CHAR(36)      NOT NULL,
  `month`             TINYINT       NOT NULL,
  `year`              SMALLINT      NOT NULL,
  `working_days`      INT           NOT NULL,
  `status`            ENUM('draft','approved','paid') NOT NULL DEFAULT 'draft',
  `total_gross`       DECIMAL(14,2) NOT NULL DEFAULT 0,
  `total_deductions`  DECIMAL(14,2) NOT NULL DEFAULT 0,
  `total_net`         DECIMAL(14,2) NOT NULL DEFAULT 0,
  `notes`             TEXT          NULL,
  `created_by`        CHAR(36)      NULL,
  `approved_by`       CHAR(36)      NULL,
  `approved_at`       DATETIME      NULL,
  `created_at`        TIMESTAMP     NULL,
  `updated_at`        TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hr_payroll_tenant_month_unique` (`tenant_id`, `month`, `year`),
  INDEX `hr_payroll_runs_tenant_idx` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Individual payslips
CREATE TABLE IF NOT EXISTS `hr_payslips` (
  `id`                  CHAR(36)      NOT NULL,
  `payroll_run_id`      CHAR(36)      NOT NULL,
  `tenant_id`           CHAR(36)      NOT NULL,
  `employee_id`         CHAR(36)      NOT NULL,
  `month`               TINYINT       NOT NULL,
  `year`                SMALLINT      NOT NULL,
  `working_days`        INT           NOT NULL,
  `present_days`        INT           NOT NULL DEFAULT 0,
  `absent_days`         INT           NOT NULL DEFAULT 0,
  `paid_leave_days`     INT           NOT NULL DEFAULT 0,
  `unpaid_leave_days`   INT           NOT NULL DEFAULT 0,
  `late_count`          INT           NOT NULL DEFAULT 0,
  `overtime_hours`      DECIMAL(5,2)  NOT NULL DEFAULT 0,
  `basic_salary`        DECIMAL(14,2) NOT NULL,
  `housing_allowance`   DECIMAL(14,2) NOT NULL DEFAULT 0,
  `transport_allowance` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `other_allowances`    DECIMAL(14,2) NOT NULL DEFAULT 0,
  `gross_salary`        DECIMAL(14,2) NOT NULL,
  `absent_deduction`    DECIMAL(14,2) NOT NULL DEFAULT 0,
  `unpaid_leave_deduction` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `late_deduction`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `other_deductions`    DECIMAL(14,2) NOT NULL DEFAULT 0,
  `overtime_pay`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `net_salary`          DECIMAL(14,2) NOT NULL,
  `status`              ENUM('draft','paid') NOT NULL DEFAULT 'draft',
  `created_at`          TIMESTAMP     NULL,
  `updated_at`          TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hr_payslips_run_emp_unique` (`payroll_run_id`, `employee_id`),
  INDEX `hr_payslips_employee_idx` (`employee_id`),
  INDEX `hr_payslips_tenant_idx`   (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Register HR module
INSERT INTO `module_catalog` (`id`, `code`, `name`, `description`, `is_active`, `created_at`)
SELECT UUID(), 'hr', 'HR & Payroll',
  'Employee management, clock-in/out attendance tracking, leave management, and monthly payroll calculation.',
  1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `module_catalog` WHERE `code` = 'hr');

-- 9. Permissions
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.employee.manage', 'Create and manage employee profiles and shifts'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.employee.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.attendance.manage', 'Manual correction of attendance records'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.attendance.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.leave.manage', 'Approve or reject employee leave requests'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.leave.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.payroll.manage', 'Generate and process monthly payroll'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.payroll.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'hr.report.view', 'View HR attendance and payroll reports'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'hr.report.view');

-- 10. Grant all HR permissions to every existing Company Admin role
--     (new tenants created after this migration get them automatically via SeedsSystemRoles)
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Company Admin'
  AND r.is_system_role = 1
  AND p.code IN (
      'hr.employee.manage',
      'hr.attendance.manage',
      'hr.leave.manage',
      'hr.payroll.manage',
      'hr.report.view'
  )
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Done. Enable via admin portal for a tenant, then seed default leave types:
-- INSERT INTO hr_leave_types (id,tenant_id,name,is_paid,days_per_year,is_active,created_at,updated_at)
-- VALUES (UUID(),'<tid>','Annual Leave',1,21,1,NOW(),NOW()),
--        (UUID(),'<tid>','Sick Leave',1,14,1,NOW(),NOW()),
--        (UUID(),'<tid>','Unpaid Leave',0,NULL,1,NOW(),NOW());
