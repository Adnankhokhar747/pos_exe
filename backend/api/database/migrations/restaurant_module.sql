-- ============================================================
-- Restaurant Module Migration
-- Run via phpMyAdmin on the live database
-- ============================================================

-- 1. Restaurant Tables (physical tables in the venue)
CREATE TABLE IF NOT EXISTS `restaurant_tables` (
  `id`           CHAR(36)      NOT NULL,
  `tenant_id`    CHAR(36)      NOT NULL,
  `branch_id`    CHAR(36)      NULL,
  `table_number` VARCHAR(20)   NOT NULL,
  `label`        VARCHAR(100)  NULL COMMENT 'Friendly display name e.g. Window Seat',
  `capacity`     TINYINT       NOT NULL DEFAULT 4,
  `status`       ENUM('available','occupied','reserved','cleaning') NOT NULL DEFAULT 'available',
  `section`      VARCHAR(50)   NULL COMMENT 'e.g. Indoor, Outdoor, VIP',
  `notes`        TEXT          NULL,
  `is_active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`   TIMESTAMP     NULL,
  `updated_at`   TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `restaurant_tables_tenant_branch_number_unique` (`tenant_id`, `branch_id`, `table_number`),
  INDEX `restaurant_tables_tenant_idx`  (`tenant_id`),
  INDEX `restaurant_tables_status_idx`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table Sessions (one per "sitting" — opened when guests arrive, closed when they pay)
CREATE TABLE IF NOT EXISTS `restaurant_table_sessions` (
  `id`          CHAR(36)      NOT NULL,
  `tenant_id`   CHAR(36)      NOT NULL,
  `table_id`    CHAR(36)      NOT NULL,
  `opened_by`   CHAR(36)      NULL COMMENT 'User who opened the session',
  `opened_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at`   TIMESTAMP     NULL,
  `covers`      TINYINT       NOT NULL DEFAULT 1 COMMENT 'Number of diners',
  `waiter_name` VARCHAR(100)  NULL,
  `invoice_id`  CHAR(36)      NULL COMMENT 'Linked invoice once billed',
  `notes`       TEXT          NULL,
  `created_at`  TIMESTAMP     NULL,
  `updated_at`  TIMESTAMP     NULL,
  PRIMARY KEY (`id`),
  INDEX `restaurant_table_sessions_table_idx`  (`table_id`),
  INDEX `restaurant_table_sessions_tenant_idx` (`tenant_id`),
  INDEX `restaurant_table_sessions_closed_idx` (`closed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Restaurant Orders (one per session — accumulates all items for the sitting)
CREATE TABLE IF NOT EXISTS `restaurant_orders` (
  `id`         CHAR(36)     NOT NULL,
  `tenant_id`  CHAR(36)     NOT NULL,
  `session_id` CHAR(36)     NOT NULL,
  `status`     ENUM('open','closed','cancelled') NOT NULL DEFAULT 'open',
  `notes`      TEXT         NULL,
  `created_by` CHAR(36)     NULL,
  `created_at` TIMESTAMP    NULL,
  `updated_at` TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `restaurant_orders_session_unique` (`session_id`),
  INDEX `restaurant_orders_tenant_idx` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Order Items (individual line items; kds_ticket_id set when sent to kitchen)
CREATE TABLE IF NOT EXISTS `restaurant_order_items` (
  `id`            CHAR(36)       NOT NULL,
  `order_id`      CHAR(36)       NOT NULL,
  `product_id`    CHAR(36)       NULL,
  `product_name`  VARCHAR(255)   NOT NULL,
  `quantity`      DECIMAL(10,3)  NOT NULL DEFAULT 1,
  `unit_price`    DECIMAL(14,4)  NOT NULL DEFAULT 0,
  `subtotal`      DECIMAL(14,4)  NOT NULL DEFAULT 0,
  `notes`         TEXT           NULL COMMENT 'Special instructions from guest',
  `kds_ticket_id` CHAR(36)       NULL COMMENT 'Set when this item has been sent to kitchen',
  `kds_status`    ENUM('pending','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending',
  `created_at`    TIMESTAMP      NULL,
  `updated_at`    TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `restaurant_order_items_order_idx`  (`order_id`),
  INDEX `restaurant_order_items_ticket_idx` (`kds_ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. KDS Tickets (one per "Send to Kitchen" action — groups items sent in the same batch)
CREATE TABLE IF NOT EXISTS `restaurant_kds_tickets` (
  `id`           CHAR(36)     NOT NULL,
  `tenant_id`    CHAR(36)     NOT NULL,
  `order_id`     CHAR(36)     NOT NULL,
  `status`       ENUM('pending','preparing','ready','done') NOT NULL DEFAULT 'pending',
  `sent_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at`   TIMESTAMP    NULL,
  `completed_at` TIMESTAMP    NULL,
  `created_at`   TIMESTAMP    NULL,
  `updated_at`   TIMESTAMP    NULL,
  PRIMARY KEY (`id`),
  INDEX `restaurant_kds_tickets_tenant_idx` (`tenant_id`),
  INDEX `restaurant_kds_tickets_status_idx` (`status`),
  INDEX `restaurant_kds_tickets_order_idx`  (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Split Bills (optional; created when guests split the check)
CREATE TABLE IF NOT EXISTS `restaurant_split_bills` (
  `id`           CHAR(36)       NOT NULL,
  `tenant_id`    CHAR(36)       NOT NULL,
  `session_id`   CHAR(36)       NOT NULL,
  `split_count`  TINYINT        NOT NULL DEFAULT 2,
  `total_amount` DECIMAL(14,4)  NOT NULL DEFAULT 0,
  `status`       ENUM('pending','completed') NOT NULL DEFAULT 'pending',
  `created_at`   TIMESTAMP      NULL,
  `updated_at`   TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `restaurant_split_bills_session_idx` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Split Bill Parties (one row per guest/party in a split)
CREATE TABLE IF NOT EXISTS `restaurant_split_bill_parties` (
  `id`            CHAR(36)       NOT NULL,
  `split_bill_id` CHAR(36)       NOT NULL,
  `party_number`  TINYINT        NOT NULL,
  `amount`        DECIMAL(14,4)  NOT NULL DEFAULT 0,
  `is_paid`       TINYINT(1)     NOT NULL DEFAULT 0,
  `invoice_id`    CHAR(36)       NULL,
  `paid_at`       TIMESTAMP      NULL,
  `created_at`    TIMESTAMP      NULL,
  `updated_at`    TIMESTAMP      NULL,
  PRIMARY KEY (`id`),
  INDEX `restaurant_split_bill_parties_split_idx` (`split_bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Menu Category Settings (controls which product categories appear on the restaurant ordering screen)
CREATE TABLE IF NOT EXISTS `restaurant_menu_settings` (
  `id`          CHAR(36)   NOT NULL,
  `tenant_id`   CHAR(36)   NOT NULL,
  `category_id` CHAR(36)   NOT NULL,
  `is_visible`  TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order`  INT        NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP  NULL,
  `updated_at`  TIMESTAMP  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `restaurant_menu_settings_unique` (`tenant_id`, `category_id`),
  INDEX `restaurant_menu_settings_tenant_idx` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Register module in catalog
INSERT INTO `module_catalog` (`id`, `code`, `name`, `description`, `is_active`, `created_at`)
SELECT UUID(), 'restaurant', 'Restaurant & Table Management',
  'Table management, kitchen display system (KDS), menu categories, split bills, and dine-in order tracking.',
  1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `module_catalog` WHERE `code` = 'restaurant');

-- 10. Add permissions
INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'restaurant.table.manage', 'Create, edit, and manage restaurant tables and open/close sessions'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'restaurant.table.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'restaurant.order.manage', 'Create and manage dine-in orders and send items to the kitchen'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'restaurant.order.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'restaurant.kds.view', 'View and update the Kitchen Display System'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'restaurant.kds.view');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'restaurant.split.manage', 'Create and process split bills for tables'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'restaurant.split.manage');

INSERT INTO `permissions` (`id`, `code`, `description`)
SELECT UUID(), 'restaurant.report.view', 'View restaurant sales and table-turn reports'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'restaurant.report.view');

-- 11. Grant all restaurant permissions to existing Company Admin roles
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Company Admin'
  AND r.is_system_role = 1
  AND p.code IN (
    'restaurant.table.manage',
    'restaurant.order.manage',
    'restaurant.kds.view',
    'restaurant.split.manage',
    'restaurant.report.view'
  )
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 12. Seed Waiter role for all existing tenants
INSERT INTO `roles` (`id`, `tenant_id`, `name`, `is_system_role`)
SELECT UUID(), t.id, 'Waiter', 1
FROM `tenants` t
WHERE NOT EXISTS (
    SELECT 1 FROM `roles` r WHERE r.tenant_id = t.id AND r.name = 'Waiter'
);

-- 13. Assign Waiter permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Waiter'
  AND r.is_system_role = 1
  AND p.code IN ('restaurant.order.manage', 'restaurant.split.manage')
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 14. Seed Kitchen Staff role for all existing tenants
INSERT INTO `roles` (`id`, `tenant_id`, `name`, `is_system_role`)
SELECT UUID(), t.id, 'Kitchen Staff', 1
FROM `tenants` t
WHERE NOT EXISTS (
    SELECT 1 FROM `roles` r WHERE r.tenant_id = t.id AND r.name = 'Kitchen Staff'
);

-- 15. Assign Kitchen Staff permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Kitchen Staff'
  AND r.is_system_role = 1
  AND p.code IN ('restaurant.kds.view')
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 16. Seed Restaurant Manager role for all existing tenants
INSERT INTO `roles` (`id`, `tenant_id`, `name`, `is_system_role`)
SELECT UUID(), t.id, 'Restaurant Manager', 1
FROM `tenants` t
WHERE NOT EXISTS (
    SELECT 1 FROM `roles` r WHERE r.tenant_id = t.id AND r.name = 'Restaurant Manager'
);

-- 17. Assign Restaurant Manager permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'Restaurant Manager'
  AND r.is_system_role = 1
  AND p.code IN (
    'restaurant.table.manage',
    'restaurant.order.manage',
    'restaurant.kds.view',
    'restaurant.split.manage',
    'restaurant.report.view'
  )
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Done. Enable the module per tenant via admin portal or:
-- INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, created_at, updated_at)
-- SELECT UUID(), '<tenant_id>', id, 1, NOW(), NOW() FROM module_catalog WHERE code = 'restaurant';
