import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// Seeds the permission catalog from docs/00-functional-specification.md §15,
// a default tenant/branch/warehouse, a Super Admin role granted every permission,
// and one admin user — enough for the Phase 0 exit criterion: log in and use the app.
//
// Every write here is an upsert, so this is safe to call on every application
// boot (see main.ts's BRANCH_API_AUTO_MIGRATE path) as well as from the
// standalone `pnpm seed` dev script (prisma/seed.ts) — both call this same
// function so there is one source of truth for what a fresh install looks like.
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
  { code: 'pos.sale.viewAll', module: 'pos', description: 'View every sale in the branch, not just sales the user created' },
  { code: 'hospital.doctor.manage', module: 'hospital', description: 'Create, edit, and manage doctor profiles and schedules' },
  { code: 'hospital.patient.manage', module: 'hospital', description: 'Create and edit patient records' },
  { code: 'hospital.appointment.manage', module: 'hospital', description: 'Create, update, and transition appointments and issue tokens' },
  { code: 'hospital.appointment.viewAll', module: 'hospital', description: "View every doctor's appointments and queue, not just the linked doctor's own" },
  { code: 'hospital.report.view', module: 'hospital', description: 'View hospital/doctor reports' },
];

// Tenant-scoped system roles seeded for every company. Cashier/Inventory Manager/
// Accountant are deliberately narrow (docs/00-functional-specification.md RBAC matrix);
// Company Admin gets the full permission catalog.
const SYSTEM_ROLE_PERMISSIONS: Record<string, string[] | 'ALL'> = {
  'Company Admin': 'ALL',
  Cashier: ['pos.sale.create', 'customer.write'],
  'Inventory Manager': [
    'product.write',
    'stock.adjust',
    'stock.transfer',
    'purchase.create',
    'purchase.approve',
    'supplier.write',
  ],
  Accountant: ['report.financial.view', 'accounting.write', 'customer.write', 'supplier.write'],
  // Hospital-module roles, seeded unconditionally for every tenant like the four roles
  // above — harmless when the Hospital module is disabled (ModuleGuard blocks every
  // hospital.* endpoint regardless of role permissions), and means enabling the module
  // later for an existing tenant needs zero role-backfill migration.
  Receptionist: ['hospital.patient.manage', 'hospital.appointment.manage'],
  // Scoped to their own queue via Doctor.linkedUserId, NOT hospital.appointment.viewAll —
  // see HospitalScopeService.
  Doctor: ['hospital.appointment.manage'],
  'Hospital Manager': [
    'hospital.doctor.manage',
    'hospital.patient.manage',
    'hospital.appointment.manage',
    'hospital.appointment.viewAll',
    'hospital.report.view',
  ],
};

export async function seedDefaults(prisma: PrismaClient): Promise<void> {
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

  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
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

  const allPermissions = await prisma.permission.findMany();
  const rolesByName = new Map<string, { id: string }>();
  for (const [roleName, permissionCodes] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: roleName } },
      update: {},
      create: { tenantId: tenant.id, name: roleName, isSystemRole: true },
    });
    rolesByName.set(roleName, role);

    const grantedPermissions =
      permissionCodes === 'ALL'
        ? allPermissions
        : allPermissions.filter((permission) => permissionCodes.includes(permission.code));

    for (const permission of grantedPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const companyAdminRole = rolesByName.get('Company Admin')!;

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
    where: { userId_roleId: { userId: adminUser.id, roleId: companyAdminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: companyAdminRole.id },
  });

  const basicPlan = await prisma.plan.upsert({
    where: { name: 'Basic' },
    update: {},
    create: { name: 'Basic', userLimit: 2, invoiceLimit: 1000, branchLimit: 1 },
  });
  const professionalPlan = await prisma.plan.upsert({
    where: { name: 'Professional' },
    update: {},
    create: { name: 'Professional', userLimit: 10, invoiceLimit: 10000, branchLimit: 5 },
  });
  const enterprisePlan = await prisma.plan.upsert({
    where: { name: 'Enterprise' },
    update: {},
    create: { name: 'Enterprise', userLimit: null, invoiceLimit: null, branchLimit: null },
  });
  // basicPlan/professionalPlan exist so the admin portal has more than one plan to
  // assign new companies to; the demo tenant itself is seeded on Enterprise so this
  // script's own exit criterion (log in and use the app) is never blocked by a limit.
  void basicPlan;
  void professionalPlan;

  const oneYearOut = new Date();
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  await prisma.tenantSubscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planId: enterprisePlan.id,
      startDate: new Date(),
      expiryDate: oneYearOut,
    },
  });

  // Module catalog rows are platform-wide, not per-tenant — seeded once here, never
  // re-created by companies.service.ts's create() (new companies start with zero
  // TenantModule grants; every module is opt-in, enabled later by the Super Admin).
  await prisma.moduleCatalog.upsert({
    where: { code: 'hospital' },
    update: {},
    create: {
      code: 'hospital',
      name: 'Hospital / Doctor Management',
      description: 'Doctors, patients, appointments, daily token queues, and doctor-wise reporting.',
    },
  });

  const platformAdminPasswordHash = await argon2.hash('SuperAdmin123!');
  await prisma.platformAdmin.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      fullName: 'Platform Super Admin',
      passwordHash: platformAdminPasswordHash,
    },
  });

  const existingCashCustomer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, isWalkIn: true },
  });
  if (!existingCashCustomer) {
    await prisma.customer.create({
      data: { tenantId: tenant.id, name: 'Cash Customer', isWalkIn: true },
    });
  }

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
  // eslint-disable-next-line no-console
  console.log('Super Admin Portal login: username "superadmin", password "SuperAdmin123!".');
}
