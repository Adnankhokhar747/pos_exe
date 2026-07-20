-- ============================================================
-- Doctor Checkup/Consultation Commission Payments Table
-- Run via phpMyAdmin AFTER lab_doctor_commissions.sql
-- (checkup_commission_pct column already added to doctors
--  by lab_doctor_commissions.sql)
-- ============================================================

-- Tracks cash-outs to doctors for consultation-fee commissions
CREATE TABLE IF NOT EXISTS `checkup_commission_payments` (
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
  INDEX `checkup_comm_pay_tenant_idx` (`tenant_id`),
  INDEX `checkup_comm_pay_doctor_idx` (`doctor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
