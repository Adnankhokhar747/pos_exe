-- ============================================================
-- Lab Doctor Commission Fields + Payments Table
-- Run via phpMyAdmin AFTER lab_pharmacy_module.sql
-- ============================================================

-- 1. Add commission percentage columns to doctors table
ALTER TABLE `doctors`
  ADD COLUMN IF NOT EXISTS `lab_commission_pct`
    DECIMAL(5,2) NOT NULL DEFAULT 0
    COMMENT '% of lab order total paid as commission to referring doctor',
  ADD COLUMN IF NOT EXISTS `checkup_commission_pct`
    DECIMAL(5,2) NOT NULL DEFAULT 0
    COMMENT '% of consultation fee paid as commission (reserved for future use)';

-- 2. Lab commission payments (tracks cash-outs to referring doctors)
CREATE TABLE IF NOT EXISTS `lab_commission_payments` (
  `id`          CHAR(36)      NOT NULL,
  `tenant_id`   CHAR(36)      NOT NULL,
  `doctor_id`   CHAR(36)      NOT NULL,
  `amount`      DECIMAL(14,2) NOT NULL,
  `method`      VARCHAR(50)   NOT NULL DEFAULT 'cash'
                COMMENT 'cash | bank_transfer | cheque | other',
  `notes`       TEXT          NULL,
  `paid_at`     DATETIME      NOT NULL,
  `created_by`  CHAR(36)      NULL,
  `created_at`  TIMESTAMP     NULL,
  `updated_at`  TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  INDEX `lab_comm_pay_tenant_idx` (`tenant_id`),
  INDEX `lab_comm_pay_doctor_idx` (`doctor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
