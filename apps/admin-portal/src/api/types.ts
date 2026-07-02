export interface PlatformAdmin {
  id: string;
  username: string;
  fullName: string;
}

export interface PlatformLoginResponse {
  accessToken: string;
  admin: PlatformAdmin;
}

export type WarningLevel = 'none' | 'info' | 'warning' | 'critical';

export interface LicenseStatus {
  tenantActive: boolean;
  subscriptionStatus: 'active' | 'expired' | 'suspended' | 'cancelled';
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

export interface CompanySummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  plan: { id: string; name: string } | null;
  license: LicenseStatus;
}

export interface Plan {
  id: string;
  name: string;
  userLimit: number | null;
  invoiceLimit: number | null;
  branchLimit: number | null;
  priceMonthly: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AlertEntry {
  tenantId: string;
  tenantName: string;
  daysUntilExpiry: number;
  userCount: number;
  userLimit: number | null;
  invoiceCount: number;
  invoiceLimit: number | null;
}

export interface PlatformAlerts {
  expiringSoon: AlertEntry[];
  expired: AlertEntry[];
  nearInvoiceLimit: AlertEntry[];
  nearUserLimit: AlertEntry[];
}

export interface ModuleCatalogEntry {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ModuleStatus {
  moduleCode: string;
  name: string;
  enabled: boolean;
  blocked: boolean;
  daysUntilExpiry: number | null;
  inGracePeriod: boolean;
  expiryDate: string | null;
  limits: Record<string, number | null> | null;
}

export interface TenantModuleGrant extends ModuleStatus {
  moduleId: string;
}
