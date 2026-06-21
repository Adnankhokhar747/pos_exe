import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Seeds the permission catalog from docs/00-functional-specification.md §15,
// a default tenant/branch/warehouse, a Super Admin role granted every permission,
// and one admin user — enough for the Phase 0 exit criterion: log in and use the app.
const PERMISSION_CATALOG: Array<{ code: string; module: string; description: string }> = [
  { code: 'pos.sale.create', module: 'pos', description: 'Create a sale' },
  { code: 'pos.sale.void', module: 'pos', description: 'Void a completed sale' },
  { code: 'invoice.return.full', module: 'invoice', description: 'Process a full return' },
  { code: 'invoice.return.partial', module: 'invoice', description: 'Process a partial return' },
  { code: 'discount.apply', module: 'discount', description: 'Apply a discount within policy limits' },
  { code: 'discount.override', module: 'discount', description: 'Override the discount ceiling' },
  { code: 'product.write', module: 'product', description: 'Create or edit products' },
  { code: 'stock.adjust', module: 'inventory', description: 'Post a stock adjustment' },
  { code: 'stock.transfer', module: 'inventory', description: 'Create, dispatch, and receive stock transfers' },
  { code: 'purchase.create', module: 'purchase', description: 'Create purchase orders, goods receipts, and supplier invoices/payments' },
  { code: 'purchase.approve', module: 'purchase', description: 'Approve (send) a purchase order' },
  { code: 'customer.write', module: 'customer', description: 'Create or edit customers and record customer payments' },
  { code: 'supplier.write', module: 'supplier', description: 'Create or edit suppliers' },
  { code: 'accounting.write', module: 'accounting', description: 'Record expenses, income, and daily closings' },
  { code: 'report.financial.view', module: 'report', description: 'View financial reports' },
  { code: 'settings.write', module: 'settings', description: 'Edit system settings' },
  { code: 'user.manage', module: 'user', description: 'Manage users and roles' },
  { code: 'plugin.manage', module: 'plugin', description: 'Install/activate/deactivate plugins' },
];

async function main(): Promise<void> {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Retail Co.',
      baseCurrency: 'USD',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN' } },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      name: 'Main Store',
      code: 'MAIN',
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000010', branchId: branch.id, name: 'Main Warehouse' },
  });

  const superAdminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Super Admin' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Super Admin', isSystemRole: true },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: permission.id },
    });
  }

  const passwordHash = await argon2.hash('Admin123!');
  const adminUser = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'admin' } },
    update: {},
    create: {
      tenantId: tenant.id,
      fullName: 'Default Admin',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  const category = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000020', tenantId: tenant.id, name: 'Beverages' },
  });

  const sampleProducts = [
    { sku: 'BEV-001', barcode: '8901030875021', name: 'Cola 500ml', costPrice: '0.60', salePrice: '1.00', taxRatePct: '5' },
    { sku: 'BEV-002', barcode: '8901030875038', name: 'Mineral Water 1.5L', costPrice: '0.30', salePrice: '0.50', taxRatePct: '5' },
    { sku: 'SNK-001', barcode: '8901030875045', name: 'Potato Chips 150g', costPrice: '0.80', salePrice: '1.50', taxRatePct: '5' },
  ];

  for (const productSeed of sampleProducts) {
    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: productSeed.sku } },
      update: {},
      create: { tenantId: tenant.id, categoryId: category.id, ...productSeed },
    });

    const existingStockLevel = await prisma.stockLevel.findUnique({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
    });

    await prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
      update: {},
      create: { warehouseId: warehouse.id, productId: product.id, quantityOnHand: '100' },
    });

    // The stockLevel upsert above is a no-op on a re-seed (empty `update`), so the
    // matching ledger entry must be skipped too — otherwise re-running this script
    // inserts a ledger row with no corresponding stock_level change, breaking the
    // "ledger replays to stock_levels" invariant from docs/01-database-design.md §6.
    if (existingStockLevel) continue;

    await prisma.stockLedgerEntry.create({
      data: {
        warehouseId: warehouse.id,
        productId: product.id,
        movementType: 'opening_balance',
        quantityDelta: '100',
        unitCostAtMove: productSeed.costPrice,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Login with username "admin", password "Admin123!".');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
