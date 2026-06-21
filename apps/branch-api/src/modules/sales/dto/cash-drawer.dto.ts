import { IsNumberString, IsString } from 'class-validator';

export class OpenCashDrawerDto {
  @IsString()
  branchId!: string;

  @IsNumberString()
  openingFloat!: string;
}

export class CloseCashDrawerDto {
  @IsNumberString()
  closingCount!: string;
}
