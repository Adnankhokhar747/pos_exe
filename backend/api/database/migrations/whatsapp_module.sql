-- ============================================================
-- WhatsApp Notification Module Migration
-- Run this on the live database via phpMyAdmin
-- ============================================================

-- 1. WhatsApp settings per tenant
CREATE TABLE IF NOT EXISTS `whatsapp_settings` (
  `id`                       CHAR(36)       NOT NULL,
  `tenant_id`                CHAR(36)       NOT NULL,
  `provider`                 ENUM('ultramsg','meta','twilio') NOT NULL DEFAULT 'ultramsg',
  `api_token`                VARCHAR(500)   NULL COMMENT 'UltraMsg token / Meta access token / Twilio auth token',
  `instance_id`              VARCHAR(100)   NULL COMMENT 'UltraMsg instance ID / Twilio account SID',
  `phone_number_id`          VARCHAR(100)   NULL COMMENT 'Meta Cloud API phone number ID',
  `from_number`              VARCHAR(30)    NULL COMMENT 'Business WhatsApp number in E.164',
  `is_enabled`               TINYINT(1)     NOT NULL DEFAULT 1,
  `notify_invoice`           TINYINT(1)     NOT NULL DEFAULT 1,
  `notify_appointment`       TINYINT(1)     NOT NULL DEFAULT 1,
  `notify_installment_due`   TINYINT(1)     NOT NULL DEFAULT 1,
  `notify_installment_paid`  TINYINT(1)     NOT NULL DEFAULT 0,
  `reminder_days_before`     TINYINT        NOT NULL DEFAULT 3,
  `template_invoice`         TEXT           NULL,
  `template_appointment`     TEXT           NULL,
  `template_installment_due` TEXT           NULL,
  `template_installment_paid` TEXT          NULL,
  `created_at`               TIMESTAMP      NULL,
  `updated_at`               TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `whatsapp_settings_tenant_unique` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. WhatsApp message log
CREATE TABLE IF NOT EXISTS `whatsapp_logs` (
  `id`               CHAR(36)       NOT NULL,
  `tenant_id`        CHAR(36)       NOT NULL,
  `to_number`        VARCHAR(30)    NOT NULL,
  `message`          TEXT           NOT NULL,
  `status`           ENUM('sent','failed') NOT NULL DEFAULT 'sent',
  `error_message`    TEXT           NULL,
  `reference_type`   VARCHAR(50)    NULL COMMENT 'invoice | appointment | installment',
  `reference_id`     CHAR(36)       NULL,
  `created_at`       TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `whatsapp_logs_tenant_idx`  (`tenant_id`),
  INDEX `whatsapp_logs_created_idx` (`created_at`),
  INDEX `whatsapp_logs_ref_idx`     (`reference_type`, `reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Register WhatsApp module in catalog
INSERT INTO `module_catalog` (`id`, `code`, `name`, `description`, `is_active`, `created_at`)
SELECT UUID(), 'whatsapp', 'WhatsApp Notifications',
  'Send automated WhatsApp messages for invoices, appointments, and lease installment reminders.',
  1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `module_catalog` WHERE `code` = 'whatsapp');

-- 4. Add permission
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'whatsapp.settings.manage', 'Manage WhatsApp notification settings and templates'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'whatsapp.settings.manage');

-- Done. Enable module per tenant via admin portal or:
-- INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, created_at, updated_at)
-- SELECT UUID(), '<tenant_id>', id, 1, NOW(), NOW() FROM module_catalog WHERE code = 'whatsapp';
