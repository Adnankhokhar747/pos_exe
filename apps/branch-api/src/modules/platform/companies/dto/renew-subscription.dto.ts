import { IsInt, IsOptional, Min } from 'class-validator';

export class RenewSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  extendMonths?: number;
}
