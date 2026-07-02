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
