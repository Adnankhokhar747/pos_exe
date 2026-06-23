export interface AuthenticatedUser {
  id: string;
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
  rolePermissions: { permission: Permission }[];
}

export interface TenantUser {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  userRoles: { role: Role }[];
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
  warehouseId: string;
  status: string;
  createdAt: string;
  lines: PurchaseOrderLine[];
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
  status: string;
  receivedAt: string;
  lines: GoodsReceiptLine[];
}

export interface SupplierInvoice {
  id: string;
  invoiceNo: string;
  supplierId: string;
  amount: string;
  amountPaid: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: string;
  method: string;
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
}

export interface IncomeEntry {
  id: string;
  branchId: string;
  category: string;
  amount: string;
  note: string | null;
  occurredAt: string;
}

export interface DailyClosing {
  id: string;
  branchId: string;
  businessDate: string;
  expectedCash: string;
  countedCash: string;
  variance: string;
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
  lines?: InvoiceLine[];
  payments?: Payment[];
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
