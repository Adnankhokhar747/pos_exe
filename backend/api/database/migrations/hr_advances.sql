-- HR Employee Advances
CREATE TABLE IF NOT EXISTS `hr_advances` (
  `id`                  CHAR(36)       NOT NULL,
  `tenant_id`           CHAR(36)       NOT NULL,
  `employee_id`         CHAR(36)       NOT NULL,
  `amount`              DECIMAL(14,2)  NOT NULL,
  `remaining_balance`   DECIMAL(14,2)  NOT NULL,
  `deduction_type`      ENUM('full_once','recurring') NOT NULL DEFAULT 'recurring',
  `monthly_installment` DECIMAL(14,2)  NULL COMMENT 'Used when deduction_type=recurring',
  `total_installments`  INT            NULL COMMENT 'Informational; computed from amount / monthly_installment',
  `installments_paid`   INT            NOT NULL DEFAULT 0,
  `status`              ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  `issued_date`         DATE           NOT NULL,
  `notes`               TEXT           NULL,
  `created_by`          CHAR(36)       NULL,
  `created_at`          TIMESTAMP      NULL,
  `updated_at`          TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX (`tenant_id`),
  INDEX (`employee_id`),
  INDEX (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add advance deduction column to hr_payslips
ALTER TABLE `hr_payslips`
  ADD COLUMN IF NOT EXISTS `advance_deduction` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `other_deductions`;
