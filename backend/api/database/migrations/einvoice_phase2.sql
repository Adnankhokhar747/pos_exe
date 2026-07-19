-- ============================================================
-- E-Invoice Phase 2 Migration
-- Run this AFTER einvoice_module.sql (Phase 1 must be in place)
-- ============================================================

-- 1. Phase 2 columns on einvoice_settings
ALTER TABLE `einvoice_settings`
  ADD COLUMN IF NOT EXISTS `private_key`         TEXT          NULL AFTER `phase`,
  ADD COLUMN IF NOT EXISTS `certificate`         TEXT          NULL AFTER `private_key`,
  ADD COLUMN IF NOT EXISTS `csr`                 TEXT          NULL AFTER `certificate`,
  ADD COLUMN IF NOT EXISTS `ccsid_token`         TEXT          NULL AFTER `csr`,
  ADD COLUMN IF NOT EXISTS `ccsid_secret`        TEXT          NULL AFTER `ccsid_token`,
  ADD COLUMN IF NOT EXISTS `pcsid_token`         TEXT          NULL AFTER `ccsid_secret`,
  ADD COLUMN IF NOT EXISTS `pcsid_secret`        TEXT          NULL AFTER `pcsid_token`,
  ADD COLUMN IF NOT EXISTS `onboarding_status`   VARCHAR(30)   NOT NULL DEFAULT 'none' AFTER `pcsid_secret`,
  ADD COLUMN IF NOT EXISTS `invoice_counter`     INT           NOT NULL DEFAULT 0 AFTER `onboarding_status`,
  ADD COLUMN IF NOT EXISTS `last_invoice_hash`   VARCHAR(512)  NULL AFTER `invoice_counter`,
  ADD COLUMN IF NOT EXISTS `zatca_env`           VARCHAR(10)   NOT NULL DEFAULT 'sandbox' AFTER `last_invoice_hash`;

-- 2. Phase 2 columns on invoices
ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `einvoice_xml`          LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `einvoice_signed_xml`   LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `einvoice_hash`         VARCHAR(512) NULL,
  ADD COLUMN IF NOT EXISTS `einvoice_counter`      INT NULL,
  ADD COLUMN IF NOT EXISTS `einvoice_status`       VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS `einvoice_zatca_response` TEXT NULL;

-- Done.
-- onboarding_status values: none | key_generated | compliance_pending | compliance_done | production_live
-- einvoice_status values:   pending | reported | cleared | failed
