import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const PRINTER_TYPES = ['thermal_80', 'thermal_58', 'a4', 'pdf'] as const;

export class UpsertPrinterDto {
  @IsString()
  name!: string;

  @IsIn(PRINTER_TYPES)
  type!: (typeof PRINTER_TYPES)[number];

  @IsString()
  systemPrinterName!: string;

  @IsOptional()
  @IsBoolean()
  isDefaultReceipt?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultInvoice?: boolean;
}
