import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitExceededError } from '../../common/exceptions/domain-exception';

export type WarningLevel = 'none' | 'info' | 'warning' | 'critical';

export interface LicenseStatus {
  tenantActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  daysUntilExpiry: number;
  inGracePeriod: boolean;
  blocked: boolean;
  warningLevel: WarningLevel;
  message: string | null;
  userLimit: number | null;
  userCount: number;
  invoiceLimit: number | null;
  invoiceCount: number;
  branchLimit: number | null;
  branchCount: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Severity escalation per docs requirement: warn at 30/15/7/3/1 days before expiry,
// each step more severe than the last.
function warningLevelForDaysRemaining(days: number): WarningLevel {
  if (days <= 1) return 'critical';
  if (days <= 7) return 'warning';
  if (days <= 30) return 'info';
  return 'none';
}

@Injectable()
export class LicenseStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async computeStatus(tenantId: string): Promise<LicenseStatus> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    const [userCount, invoiceCount, branchCount] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, status: 'active' } }),
      this.prisma.invoice.count({ where: { branch: { tenantId } } }),
      this.prisma.branch.count({ where: { tenantId } }),
    ]);

    if (!subscription) {
      return {
        tenantActive: tenant.status === 'active',
        subscriptionStatus: 'cancelled',
        daysUntilExpiry: -1,
        inGracePeriod: false,
        blocked: true,
        warningLevel: 'critical',
        message: 'This company has no active subscription. Please contact your Super Admin.',
        userLimit: null,
        userCount,
        invoiceLimit: null,
        invoiceCount,
        branchLimit: null,
        branchCount,
      };
    }

    const now = Date.now();
    const daysUntilExpiry = Math.ceil((subscription.expiryDate.getTime() - now) / MS_PER_DAY);
    const graceMs = subscription.gracePeriodDays * MS_PER_DAY;
    const inGracePeriod = daysUntilExpiry < 0 && now <= subscription.expiryDate.getTime() + graceMs;
    const pastGrace = now > subscription.expiryDate.getTime() + graceMs;

    let subscriptionStatus = subscription.status;
    if (pastGrace && subscriptionStatus === 'active') {
      subscriptionStatus = 'expired';
      // Persisted lazily on read rather than via a cron job — there is no scheduler
      // in this codebase and expiry is meant to be enforced live, not on a timer.
      await this.prisma.tenantSubscription.update({
        where: { tenantId },
        data: { status: 'expired' },
      });
    }

    const tenantActive = tenant.status === 'active';
    const blocked = !tenantActive || subscriptionStatus === 'suspended' || subscriptionStatus === 'cancelled' || pastGrace;

    let warningLevel: WarningLevel = 'none';
    let message: string | null = null;
    if (blocked) {
      warningLevel = 'critical';
      message = !tenantActive
        ? 'This company has been suspended. Please contact your Super Admin.'
        : 'Your subscription has expired. Please renew to continue using the system.';
    } else if (inGracePeriod) {
      warningLevel = 'critical';
      message = `Your subscription expired and is in a grace period. Please renew immediately to avoid losing access.`;
    } else if (daysUntilExpiry <= 30) {
      warningLevel = warningLevelForDaysRemaining(daysUntilExpiry);
      message = `Your subscription will expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}. Please renew.`;
    }

    return {
      tenantActive,
      subscriptionStatus,
      daysUntilExpiry,
      inGracePeriod,
      blocked,
      warningLevel,
      message,
      userLimit: subscription.plan.userLimit,
      userCount,
      invoiceLimit: subscription.plan.invoiceLimit,
      invoiceCount,
      branchLimit: subscription.plan.branchLimit,
      branchCount,
    };
  }

  async checkInvoiceLimit(tenantId: string): Promise<void> {
    const status = await this.computeStatus(tenantId);
    if (status.invoiceLimit !== null && status.invoiceCount >= status.invoiceLimit) {
      throw new LimitExceededError(
        `Invoice limit reached (${status.invoiceLimit}). Upgrade your plan to create more invoices.`,
      );
    }
  }

  async checkUserLimit(tenantId: string): Promise<void> {
    const status = await this.computeStatus(tenantId);
    if (status.userLimit !== null && status.userCount >= status.userLimit) {
      throw new LimitExceededError(`User limit reached (${status.userLimit}). Upgrade your plan to add more users.`);
    }
  }

  async checkBranchLimit(tenantId: string): Promise<void> {
    const status = await this.computeStatus(tenantId);
    if (status.branchLimit !== null && status.branchCount >= status.branchLimit) {
      throw new LimitExceededError(`Branch limit reached (${status.branchLimit}). Upgrade your plan to add more branches.`);
    }
  }
}
