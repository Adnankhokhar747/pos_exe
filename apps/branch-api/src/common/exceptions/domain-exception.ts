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
