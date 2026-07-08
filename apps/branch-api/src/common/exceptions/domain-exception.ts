export abstract class DomainException extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
}

export class InvalidCredentialsError extends DomainException {
  readonly code = 'invalid_credentials';
  readonly httpStatus = 401;

  constructor() {
    super('Username or password is incorrect.');
  }
}

export class InsufficientStockError extends DomainException {
  readonly code = 'insufficient_stock';
  readonly httpStatus = 409;

  constructor(productId: string, available: string, requested: string) {
    super(`Insufficient stock for product ${productId}: available ${available}, requested ${requested}.`);
  }
}

export class InvoiceAlreadyVoidedError extends DomainException {
  readonly code = 'invoice_already_voided';
  readonly httpStatus = 409;

  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} is already voided.`);
  }
}

export class PaymentMismatchError extends DomainException {
  readonly code = 'payment_mismatch';
  readonly httpStatus = 422;

  constructor(grandTotal: string, paid: string) {
    super(`Grand total ${grandTotal} does not match total payments ${paid}.`);
  }
}

export class InvalidCouponError extends DomainException {
  readonly code = 'invalid_coupon';
  readonly httpStatus = 422;

  constructor(code: string, reason: string) {
    super(`Coupon ${code} cannot be applied: ${reason}.`);
  }
}

export class InvalidGiftCardError extends DomainException {
  readonly code = 'invalid_gift_card';
  readonly httpStatus = 422;

  constructor(code: string, reason: string) {
    super(`Gift card ${code} cannot be used: ${reason}.`);
  }
}

export class InsufficientLoyaltyPointsError extends DomainException {
  readonly code = 'insufficient_loyalty_points';
  readonly httpStatus = 422;

  constructor(available: string, requested: string) {
    super(`Insufficient loyalty points: available ${available}, requested ${requested}.`);
  }
}

export class SerialNumberUnavailableError extends DomainException {
  readonly code = 'serial_number_unavailable';
  readonly httpStatus = 409;

  constructor(serialNo: string) {
    super(`Serial number ${serialNo} is not available in stock.`);
  }
}

export class InsufficientBatchStockError extends DomainException {
  readonly code = 'insufficient_batch_stock';
  readonly httpStatus = 409;

  constructor(productId: string, available: string, requested: string) {
    super(`Insufficient batch-tracked stock for product ${productId}: available ${available}, requested ${requested}.`);
  }
}

export class LicenseBlockedError extends DomainException {
  readonly code = 'license_blocked';
  readonly httpStatus = 403;

  constructor(message: string) {
    super(message);
  }
}

export class LimitExceededError extends DomainException {
  readonly code = 'limit_exceeded';
  readonly httpStatus = 409;

  constructor(message: string) {
    super(message);
  }
}

export class ModuleBlockedError extends DomainException {
  readonly code = 'module_blocked';
  readonly httpStatus = 403;

  constructor(message: string) {
    super(message);
  }
}

export class InvalidAppointmentStatusTransitionError extends DomainException {
  readonly code = 'invalid_appointment_status_transition';
  readonly httpStatus = 422;

  constructor(from: string, to: string) {
    super(`Cannot transition appointment from "${from}" to "${to}".`);
  }
}

export class TokenIssuanceConflictError extends DomainException {
  readonly code = 'token_issuance_conflict';
  readonly httpStatus = 409;

  constructor() {
    super('Too many tokens are being issued for this doctor at once. Please try again.');
  }
}

export class BillAlreadyFinalizedError extends DomainException {
  readonly code = 'bill_already_finalized';
  readonly httpStatus = 409;

  constructor() {
    super('A bill has already been finalized for this appointment.');
  }
}

export class AppointmentNotBillableError extends DomainException {
  readonly code = 'appointment_not_billable';
  readonly httpStatus = 422;

  constructor(status: string) {
    super(`Cannot bill an appointment with status "${status}". Must be "confirmed".`);
  }
}

export class InsufficientPatientBalanceError extends DomainException {
  readonly code = 'insufficient_patient_balance';
  readonly httpStatus = 422;

  constructor(available: string, requested: string) {
    super(`Patient advance balance ${available} is less than requested advance applied ${requested}.`);
  }
}

export class UnderpaidBillError extends DomainException {
  readonly code = 'underpaid_bill';
  readonly httpStatus = 422;

  constructor(due: string, paid: string) {
    super(`Bill total ${due} exceeds total payment received ${paid}. Patient must fully settle the bill.`);
  }
}

export class InvalidPatientAdvancePaymentError extends DomainException {
  readonly code = 'invalid_patient_advance_payment';
  readonly httpStatus = 422;

  constructor(message: string) {
    super(message);
  }
}

export class RefundExceedsBalanceError extends DomainException {
  readonly code = 'refund_exceeds_balance';
  readonly httpStatus = 422;

  constructor(available: string, requested: string) {
    super(`Patient advance balance ${available} is less than requested refund ${requested}.`);
  }
}

export class CategoryInUseError extends DomainException {
  readonly code = 'category_in_use';
  readonly httpStatus = 409;

  constructor(productCount: number) {
    super(`Cannot delete this category: ${productCount} product(s) are still assigned to it.`);
  }
}

export class CurrencyInUseError extends DomainException {
  readonly code = 'currency_in_use';
  readonly httpStatus = 409;

  constructor(reason: string) {
    super(`Cannot delete this currency: ${reason}.`);
  }
}

export class LastActiveBranchError extends DomainException {
  readonly code = 'last_active_branch';
  readonly httpStatus = 409;

  constructor() {
    super('Cannot deactivate the only active branch for this company.');
  }
}

export class SystemRoleImmutableError extends DomainException {
  readonly code = 'system_role_immutable';
  readonly httpStatus = 409;

  constructor(name: string) {
    super(`"${name}" is a built-in system role and cannot be modified or deleted.`);
  }
}

export class RoleInUseError extends DomainException {
  readonly code = 'role_in_use';
  readonly httpStatus = 409;

  constructor(userCount: number) {
    super(`Cannot delete this role: ${userCount} user(s) are still assigned to it.`);
  }
}

export class AppointmentNotDeletableError extends DomainException {
  readonly code = 'appointment_not_deletable';
  readonly httpStatus = 409;

  constructor() {
    super('Cannot delete a completed appointment: it has a finalized bill and financial records.');
  }
}

export class RecordAlreadyVoidedError extends DomainException {
  readonly code = 'record_already_voided';
  readonly httpStatus = 409;

  constructor(entity: string) {
    super(`This ${entity} is already voided.`);
  }
}

export class PurchaseOrderNotCancellableError extends DomainException {
  readonly code = 'purchase_order_not_cancellable';
  readonly httpStatus = 409;

  constructor(status: string) {
    super(`Cannot cancel a purchase order with status "${status}".`);
  }
}

export class PurchaseOrderNotEditableError extends DomainException {
  readonly code = 'purchase_order_not_editable';
  readonly httpStatus = 409;

  constructor(status: string) {
    super(`Cannot edit a purchase order with status "${status}". Only draft orders can be edited.`);
  }
}

export class GoodsReceiptNotVoidableError extends DomainException {
  readonly code = 'goods_receipt_not_voidable';
  readonly httpStatus = 409;

  constructor(reason: string) {
    super(`Cannot void this goods receipt: ${reason}.`);
  }
}

export class SupplierInvoiceNotVoidableError extends DomainException {
  readonly code = 'supplier_invoice_not_voidable';
  readonly httpStatus = 409;

  constructor(reason: string) {
    super(`Cannot void this supplier invoice: ${reason}.`);
  }
}
