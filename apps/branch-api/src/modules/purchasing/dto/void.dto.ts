import { IsString, MinLength } from 'class-validator';

export class VoidPurchaseOrderDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class VoidGoodsReceiptDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class VoidSupplierInvoiceDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class VoidSupplierPaymentDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
