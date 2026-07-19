export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  username: string;
  fullName: string;
  permissions: string[];
  branchId: string;
  branchName: string;
  warehouseId: string;
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

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
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

export interface Permission {
  id: string;
  code: string;
  module: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  isSystemRole: boolean;
  permissions: Permission[];
}

export interface TenantUser {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  roles: Role[];
}

export interface ProductWithStock {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  costPrice: string;
  salePrice: string;
  taxRatePct: string;
  taxTemplateId: string | null;
  parentProductId: string | null;
  variantAttributes: Record<string, string> | null;
  isBundle: boolean;
  trackBatches: boolean;
  trackSerials: boolean;
  quantityOnHand: string;
  deletedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface BundleComponentEntry {
  id: string;
  bundleProductId: string;
  componentProductId: string;
  quantity: string;
  componentProduct: { id: string; name: string };
}

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: string;
  taxRatePct: string;
  quantity: number;
  discountValue: string;
  trackSerials?: boolean;
  serialNumbers?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  creditLimit: string;
  currentBalance: string;
  loyaltyPoints: string;
  isActive: boolean;
  isWalkIn: boolean;
  crNumber?: string | null;
  buildingNumber?: string | null;
  streetName?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: string;
  points: string;
  balanceAfter: string;
  occurredAt: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  entryType: string;
  amount: string;
  balanceAfter: string;
  occurredAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  currentBalance: string;
  isActive: boolean;
  crNumber?: string | null;
  buildingNumber?: string | null;
  streetName?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}

export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  entryType: string;
  amount: string;
  balanceAfter: string;
  occurredAt: string;
}

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  warehouseId: string;
  status: string;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  createdAt: string;
  lines: PurchaseOrderLine[];
  paymentsSumAmount?: string | null;
  goodsReceipts?: Array<{
    id: string;
    receiptNo: string;
    supplierInvoices?: Array<{
      id: string;
      invoiceNo: string;
      amount: string;
      amountPaid: string;
      status: string;
    }>;
  }>;
}

export interface GoodsReceiptLine {
  id: string;
  productId: string;
  quantityReceived: string;
  unitCost: string;
  batchNo: string | null;
  expiryDate: string | null;
}

export interface GoodsReceipt {
  id: string;
  receiptNo: string;
  warehouseId: string;
  purchaseOrderId: string | null;
  purchaseOrder?: { id: string; orderNo: string } | null;
  status: string;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  receivedAt: string;
  lines: GoodsReceiptLine[];
}

export interface SupplierInvoice {
  id: string;
  invoiceNo: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  goodsReceiptId?: string | null;
  goodsReceipt?: {
    id: string;
    receiptNo: string;
    purchaseOrder?: { id: string; orderNo: string } | null;
  } | null;
  amount: string;
  amountPaid: string;
  status: string;
  dueDate: string | null;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  purchaseOrder?: { id: string; orderNo: string } | null;
  supplier?: { id: string; name: string } | null;
  allocations?: Array<{
    supplierInvoiceId: string;
    supplierInvoice?: {
      id: string;
      invoiceNo: string;
      goodsReceiptId?: string | null;
      goodsReceipt?: {
        purchaseOrder?: { id: string; orderNo: string } | null;
      } | null;
    } | null;
  }>;
  amount: string;
  method: string;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  paidAt: string;
}

export interface StockAdjustment {
  id: string;
  warehouseId: string;
  reasonCode: string;
  note: string | null;
  createdAt: string;
}

export interface StockTransfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  branchId: string;
  categoryId: string;
  amount: string;
  note: string | null;
  paidVia: string | null;
  occurredAt: string;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
}

export interface IncomeEntry {
  id: string;
  branchId: string;
  category: string;
  amount: string;
  note: string | null;
  occurredAt: string;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
}

export interface DailyClosing {
  id: string;
  branchId: string;
  businessDate: string;
  expectedCash: string;
  countedCash: string;
  variance: string;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  timezone: string;
  isActive: boolean;
}

export interface ProfitSummary {
  revenue: string;
  cogs: string;
  grossProfit: string;
  otherIncome: string;
  expenses: string;
  netProfit: string;
}

export interface SalesSummary {
  grossSales: string;
  discounts: string;
  taxCollected: string;
  netSales: string;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantitySold: string;
  revenue: string;
}

export interface InventoryValuationLine {
  productId: string;
  name: string;
  quantityOnHand: string;
  costPrice: string;
  value: string;
}

export interface InventoryValuation {
  lines: InventoryValuationLine[];
  total: string;
}

export interface LowStockLine {
  productId: string;
  name: string;
  quantityOnHand: string;
  reorderLevel: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  status: string;
  customerId: string | null;
  patientId: string | null;
  customer?: Customer | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  heldLabel: string | null;
  currencyCode: string | null;
  exchangeRateToBase: string | null;
  loyaltyPointsEarned: string;
  loyaltyPointsRedeemed: string;
  couponCode: string | null;
  couponDiscountAmount: string;
  createdAt: string;
  einvoiceQr?: string | null;
  einvoiceUuid?: string | null;
  lines?: InvoiceLine[];
  payments?: Payment[];
}

export interface EInvoiceSettings {
  id: string | null;
  tenantId: string;
  isActive: boolean;
  sellerNameAr: string | null;
  sellerNameEn: string | null;
  vatNumber: string | null;
  crNumber: string | null;
  buildingNumber: string | null;
  streetName: string | null;
  district: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string;
  vatRate: string;
  phase: number;
  // Phase 2 onboarding status (read-only, never exposes keys/secrets)
  onboardingStatus?: 'none' | 'key_generated' | 'compliance_pending' | 'compliance_done' | 'production_live';
  hasCsr?: boolean;
  hasCertificate?: boolean;
  hasCcsid?: boolean;
  hasPcsid?: boolean;
  invoiceCounter?: number;
  zatcaEnv?: 'sandbox' | 'production';
}

export interface InvoiceLine {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discountValue: string;
  taxAmount: string;
  lineTotal: string;
  product?: { name: string };
}

export interface Payment {
  id: string;
  invoiceId: string;
  method: string;
  amount: string;
  receivedAmount: string | null;
  changeAmount: string | null;
  reference: string | null;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export interface TenantSettings {
  id: string;
  name: string;
  baseCurrency: string;
  address: string | null;
  taxNumber: string | null;
  logoPath: string | null;
  defaultTaxTemplateId: string | null;
}

export interface ExchangeRate {
  id: string;
  currencyCode: string;
  rateToBase: string;
  effectiveAt: string;
}

export interface TaxTemplate {
  id: string;
  name: string;
  taxType: string;
  ratePct: string;
  isInclusive: boolean;
  isActive: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  expiryDate: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
}

export interface GiftCard {
  id: string;
  code: string;
  initialBalance: string;
  currentBalance: string;
  expiryDate: string | null;
  isActive: boolean;
  issuedAt: string;
}

export interface Batch {
  id: string;
  productId: string;
  warehouseId: string;
  batchNo: string;
  expiryDate: string | null;
  quantityOnHand: string;
  costPrice: string;
  product?: { name: string };
}

export interface SerialNumberRecord {
  id: string;
  productId: string;
  warehouseId: string;
  serialNo: string;
  status: 'in_stock' | 'sold' | 'returned';
  invoiceLineId: string | null;
  product?: { name: string };
}

export interface CashDrawerSession {
  id: string;
  branchId: string;
  openedBy: string;
  openingFloat: string;
  closingCount: string | null;
  expectedClose: string | null;
  variance: string | null;
  openedAt: string;
  closedAt: string | null;
}

export type PrinterType = 'thermal_80' | 'thermal_58' | 'a4' | 'pdf';

export interface Printer {
  id: string;
  branchId: string;
  name: string;
  type: PrinterType;
  systemPrinterName: string;
  isDefaultReceipt: boolean;
  isDefaultInvoice: boolean;
}

export interface ReceiptSettings {
  id: string;
  headerText: string | null;
  footerText: string | null;
  paperWidthMm: number;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Doctor {
  id: string;
  linkedUserId: string | null;
  linkedUser: { id: string; fullName: string; username: string } | null;
  name: string;
  specialization: string | null;
  phone: string | null;
  email: string | null;
  roomNumber: string | null;
  consultationFee: string;
  maxDailyAppointments: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface LinkableUser {
  id: string;
  fullName: string;
  username: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  currentBalance: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientLedgerEntry {
  id: string;
  patientId: string;
  appointmentId: string | null;
  entryType: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  occurredAt: string;
}

export interface AppointmentBillLine {
  id: string;
  lineType: string;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  product?: { id: string; name: string } | null;
}

export interface AppointmentBillPayment {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
}

export interface AppointmentBill {
  id: string;
  appointmentId: string;
  isDraft: boolean;
  consultationFee: string;
  medicineTotal: string;
  totalDue: string;
  advanceApplied: string;
  totalCollected: string;
  advanceCredited: string;
  patientBalance: string;
  finalizedAt: string | null;
  lines?: AppointmentBillLine[];
  payments?: AppointmentBillPayment[];
}

export type AppointmentType = 'walk_in' | 'advance';
export type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  appointmentType: AppointmentType;
  status: AppointmentStatus;
  appointmentDate: string;
  tokenNumber: number;
  bookedAt: string;
  arrivedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  doctor: Doctor;
  patient: Patient;
  bill?: { id: string; isDraft: boolean; totalDue: string; totalCollected: string; advanceApplied: string; advanceCredited: string; patientBalance: string; finalizedAt: string | null } | null;
}

export interface QueueStatus {
  currentToken: number;
  nextToken: number | null;
  waitingCount: number;
  completedCount: number;
}

export interface DoctorPatientCount {
  doctorId: string;
  doctorName: string;
  patientCount: number;
}

export interface PaymentMethodTotal {
  method: string;
  total: string;
  count: number;
}

export interface DoctorAppointmentSummary {
  doctorId: string;
  doctorName: string;
  walkInCount: number;
  advanceBookingCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
}

export interface DoctorRevenueSummary {
  doctorId: string;
  doctorName: string;
  consultationRevenue: string;
  appointmentCount: number;
}

export interface HospitalRevenueSummary {
  totalConsultationRevenue: string;
  totalMedicineRevenue: string;
  totalRevenue: string;
  totalAdvanceCollected: string;
  totalRefunded: string;
  byDoctor: DoctorRevenueSummary[];
}

// ─── Cloud Backup ─────────────────────────────────────────────────────────────

export interface BackupSnapshotMeta {
  id: string;
  version: number;
  label: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupStatus {
  enabled: boolean;
  autoBackup: boolean;
  maxSnapshots: number;
  lastBackedUpAt: string | null;
  snapshotCount: number;
  latestSnapshot: BackupSnapshotMeta | null;
}

// ─── Lease Module ─────────────────────────────────────────────────────────────

export type LeaseCategory = 'property' | 'vehicle' | 'appliance' | 'electronics' | 'other';
export type LeaseFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type LeaseStatus = 'active' | 'completed' | 'cancelled' | 'defaulted';
export type LeaseInstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue';

export interface LeaseInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  paidAmount: number | null;
  paidDate: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  status: LeaseInstallmentStatus;
  notes: string | null;
}

export interface LeaseAgreementSummary {
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
}

export interface LeaseAgreement {
  id: string;
  title: string;
  category: LeaseCategory;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  downPayment: number;
  financedAmount: number;
  installmentCount: number;
  installmentAmount: number;
  frequency: LeaseFrequency;
  startDate: string;
  firstInstallmentDate: string;
  status: LeaseStatus;
  notes: string | null;
  createdAt: string;
  paidInstallments?: number;
  totalPaid?: number;
  installments?: LeaseInstallment[];
  summary?: LeaseAgreementSummary;
}

export interface LeaseSummary {
  activeAgreements: number;
  completedAgreements: number;
  totalFinanced: number;
  totalCollected: number;
  totalPending: number;
  overdueInstallments: number;
  monthlyCollected: number;
}

export interface LeaseUpcomingInstallment {
  id: string;
  agreementId: string;
  agreementTitle: string;
  category: LeaseCategory;
  customerName: string | null;
  customerPhone: string | null;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: LeaseInstallmentStatus;
  daysUntilDue: number;
}

// ─── WhatsApp Notification Module ─────────────────────────────────────────────

export type WhatsAppProvider = 'ultramsg' | 'meta' | 'twilio';

export interface WhatsAppSettings {
  tenantId: string;
  provider: WhatsAppProvider;
  instanceId: string | null;
  phoneNumberId: string | null;
  fromNumber: string | null;
  isEnabled: boolean;
  notifyInvoice: boolean;
  notifyAppointment: boolean;
  notifyInstallmentDue: boolean;
  notifyInstallmentPaid: boolean;
  reminderDaysBefore: number;
  templateInvoice: string;
  templateAppointment: string;
  templateInstallmentDue: string;
  templateInstallmentPaid: string;
  hasApiToken: boolean;
}

export interface WhatsAppLog {
  id: string;
  toNumber: string;
  status: 'sent' | 'failed';
  referenceType: string | null;
  referenceId: string | null;
  errorMessage: string | null;
  createdAt: string;
}
