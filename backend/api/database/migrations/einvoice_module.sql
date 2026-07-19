-- ============================================================
-- E-Invoice Module Migration
-- Run this on the live database via phpMyAdmin or clear_cache.php
-- ============================================================

-- 1. E-Invoice tenant settings table
CREATE TABLE IF NOT EXISTS `einvoice_settings` (
  `id`              CHAR(36)       NOT NULL,
  `tenant_id`       CHAR(36)       NOT NULL,
  `is_active`       TINYINT(1)     NOT NULL DEFAULT 0,
  `seller_name_ar`  VARCHAR(255)   NULL,
  `seller_name_en`  VARCHAR(255)   NULL,
  `vat_number`      VARCHAR(15)    NULL,
  `cr_number`       VARCHAR(20)    NULL,
  `building_number` VARCHAR(20)    NULL,
  `street_name`     VARCHAR(255)   NULL,
  `district`        VARCHAR(255)   NULL,
  `city`            VARCHAR(100)   NULL,
  `postal_code`     VARCHAR(10)    NULL,
  `country_code`    CHAR(2)        NOT NULL DEFAULT 'SA',
  `vat_rate`        DECIMAL(5,2)   NOT NULL DEFAULT 15.00,
  `phase`           TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`      TIMESTAMP      NULL,
  `updated_at`      TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `einvoice_settings_tenant_id_unique` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If the table already exists (from earlier migration run), add the column:
ALTER TABLE `einvoice_settings`
  ADD COLUMN IF NOT EXISTS `is_active` TINYINT(1) NOT NULL DEFAULT 0 AFTER `tenant_id`;

-- 2. Add e-invoice address fields to customers
ALTER TABLE `customers`
  ADD COLUMN IF NOT EXISTS `cr_number`       VARCHAR(20)  NULL AFTER `tax_number`,
  ADD COLUMN IF NOT EXISTS `building_number` VARCHAR(20)  NULL AFTER `cr_number`,
  ADD COLUMN IF NOT EXISTS `street_name`     VARCHAR(255) NULL AFTER `building_number`,
  ADD COLUMN IF NOT EXISTS `district`        VARCHAR(255) NULL AFTER `street_name`,
  ADD COLUMN IF NOT EXISTS `city`            VARCHAR(100) NULL AFTER `district`,
  ADD COLUMN IF NOT EXISTS `postal_code`     VARCHAR(10)  NULL AFTER `city`,
  ADD COLUMN IF NOT EXISTS `country_code`    CHAR(2)      NULL AFTER `postal_code`;

-- 3. Add e-invoice address fields to suppliers
ALTER TABLE `suppliers`
  ADD COLUMN IF NOT EXISTS `cr_number`       VARCHAR(20)  NULL AFTER `tax_number`,
  ADD COLUMN IF NOT EXISTS `building_number` VARCHAR(20)  NULL AFTER `cr_number`,
  ADD COLUMN IF NOT EXISTS `street_name`     VARCHAR(255) NULL AFTER `building_number`,
  ADD COLUMN IF NOT EXISTS `district`        VARCHAR(255) NULL AFTER `street_name`,
  ADD COLUMN IF NOT EXISTS `city`            VARCHAR(100) NULL AFTER `district`,
  ADD COLUMN IF NOT EXISTS `postal_code`     VARCHAR(10)  NULL AFTER `city`,
  ADD COLUMN IF NOT EXISTS `country_code`    CHAR(2)      NULL AFTER `postal_code`;

-- 4. Add e-invoice QR fields to invoices
ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `einvoice_qr`   TEXT      NULL,
  ADD COLUMN IF NOT EXISTS `einvoice_uuid` CHAR(36)  NULL;

-- 5. Register einvoice module in module_catalog
INSERT INTO `module_catalog` (`id`, `code`, `name`, `description`, `is_active`, `created_at`)
SELECT UUID(), 'einvoice', 'E-Invoice (ZATCA)', 'ZATCA-compliant electronic invoicing for Saudi Arabia. Adds QR code to receipts and collects VAT registration details.', 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `module_catalog` WHERE `code` = 'einvoice');

-- 6. Add e-invoice permission
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'einvoice.settings.manage', 'Manage e-invoice settings and VAT configuration'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'einvoice.settings.manage');

-- Done. Grant the module to a tenant via admin portal or:
-- INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, created_at, updated_at)
-- SELECT UUID(), '<tenant_id>', id, 1, NOW(), NOW() FROM module_catalog WHERE code = 'einvoice';
