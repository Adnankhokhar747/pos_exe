import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../prisma/prisma.service';
import { LicenseStatus, LicenseStatusService } from '../../licensing/license-status.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';

// Duplicated from prisma/seed.ts rather than shared: seed.ts runs via ts-node outside
// the Nest build's rootDir (apps/branch-api/tsconfig.json only includes src/**/*.ts),
// so it cannot import from src/modules/** and vice versa.
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
  Receptionist: ['hospital.patient.manage', 'hospital.appointment.manage'],
  Doctor: ['hospital.appointment.manage'],
  'Hospital Manager': [
    'hospital.doctor.manage',
    'hospital.patient.manage',
    'hospital.appointment.manage',
    'hospital.appointment.viewAll',
    'hospital.report.view',
  ],
};

export interface CompanySummary {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  plan: { id: string; name: string } | null;
  license: LicenseStatus;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseStatusService: LicenseStatusService,
  ) {}

  async list(): Promise<CompanySummary[]> {
    const tenants = await this.prisma.tenant.findMany({
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(tenants.map((tenant) => this.toSummary(tenant)));
  }

  async findOne(id: string): Promise<CompanySummary> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } } },
    });
    if (!tenant) throw new NotFoundException(`Company ${id} not found.`);
    return this.toSummary(tenant);
  }

  async create(dto: CreateCompanyDto): Promise<CompanySummary> {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: dto.planId } });

    const tenant = await this.prisma.tenant.create({
      data: { name: dto.companyName, baseCurrency: dto.baseCurrency ?? 'USD' },
    });

    const branch = await this.prisma.branch.create({
      data: { tenantId: tenant.id, name: 'Main Branch', code: 'MAIN' },
    });
    await this.prisma.warehouse.create({
      data: { branchId: branch.id, name: 'Main Warehouse', isDefault: true },
    });

    const allPermissions = await this.prisma.permission.findMany();
    let companyAdminRoleId: string | null = null;
    for (const [roleName, permissionCodes] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      const role = await this.prisma.role.create({
        data: { tenantId: tenant.id, name: roleName, isSystemRole: true },
      });
      if (roleName === 'Company Admin') companyAdminRoleId = role.id;

      const grantedPermissions =
        permissionCodes === 'ALL'
          ? allPermissions
          : allPermissions.filter((permission) => permissionCodes.includes(permission.code));
      for (const permission of grantedPermissions) {
        await this.prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      }
    }

    const passwordHash = await argon2.hash(dto.adminPassword);
    const adminUser = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        fullName: dto.adminFullName,
        username: dto.adminUsername,
        email: dto.adminEmail,
        passwordHash,
      },
    });
    await this.prisma.userRole.create({ data: { userId: adminUser.id, roleId: companyAdminRoleId! } });

    await this.prisma.customer.create({
      data: { tenantId: tenant.id, name: 'Cash Customer', isWalkIn: true },
    });

    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    await this.prisma.tenantSubscription.create({
      data: { tenantId: tenant.id, planId: plan.id, startDate, expiryDate },
    });

    return this.findOne(tenant.id);
  }

  async activate(id: string): Promise<CompanySummary> {
    await this.ensureExists(id);
    await this.prisma.tenant.update({ where: { id }, data: { status: 'active' } });
    return this.findOne(id);
  }

  async suspend(id: string): Promise<CompanySummary> {
    await this.ensureExists(id);
    await this.prisma.tenant.update({ where: { id }, data: { status: 'suspended' } });
    return this.findOne(id);
  }

  // Hard delete is only permitted for companies that have never been used for real
  // business (zero invoices, zero products) — anything past that point can only be
  // suspended, matching how Customer/Supplier already use deactivate over hard-delete.
  async delete(id: string): Promise<void> {
    await this.ensureExists(id);

    const [invoiceCount, productCount] = await Promise.all([
      this.prisma.invoice.count({ where: { branch: { tenantId: id } } }),
      this.prisma.product.count({ where: { tenantId: id } }),
    ]);
    if (invoiceCount > 0 || productCount > 0) {
      throw new ConflictException(
        'This company has sales or catalog data and cannot be deleted. Suspend it instead.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const branches = await tx.branch.findMany({ where: { tenantId: id }, select: { id: true } });
      const branchIds = branches.map((branch) => branch.id);

      await tx.printer.deleteMany({ where: { tenantId: id } });
      await tx.receiptSettings.deleteMany({ where: { tenantId: id } });
      await tx.taxTemplate.deleteMany({ where: { tenantId: id } });
      await tx.warehouse.deleteMany({ where: { branchId: { in: branchIds } } });
      await tx.branch.deleteMany({ where: { tenantId: id } });

      const roles = await tx.role.findMany({ where: { tenantId: id }, select: { id: true } });
      const roleIds = roles.map((role) => role.id);
      await tx.userRole.deleteMany({ where: { roleId: { in: roleIds } } });
      await tx.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
      await tx.role.deleteMany({ where: { tenantId: id } });
      await tx.user.deleteMany({ where: { tenantId: id } });
      await tx.customer.deleteMany({ where: { tenantId: id } });
      await tx.tenantSubscription.deleteMany({ where: { tenantId: id } });
      await tx.tenant.delete({ where: { id } });
    });
  }

  async renewSubscription(id: string, dto: RenewSubscriptionDto): Promise<CompanySummary> {
    await this.ensureExists(id);
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (dto.extendMonths ?? 12));
    await this.prisma.tenantSubscription.update({
      where: { tenantId: id },
      data: { expiryDate, status: 'active' },
    });
    return this.findOne(id);
  }

  async changePlan(id: string, dto: ChangePlanDto): Promise<CompanySummary> {
    await this.ensureExists(id);
    await this.prisma.plan.findUniqueOrThrow({ where: { id: dto.planId } });
    await this.prisma.tenantSubscription.update({ where: { tenantId: id }, data: { planId: dto.planId } });
    return this.findOne(id);
  }

  private async ensureExists(id: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Company ${id} not found.`);
  }

  private async toSummary(tenant: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    subscription: { plan: { id: string; name: string } } | null;
  }): Promise<CompanySummary> {
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt,
      plan: tenant.subscription ? { id: tenant.subscription.plan.id, name: tenant.subscription.plan.name } : null,
      license: await this.licenseStatusService.computeStatus(tenant.id),
    };
  }
}
