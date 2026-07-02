import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpsertTenantModuleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsIn([1, 3, 6, 12])
  periodMonths?: 1 | 3 | 6 | 12;

  // Free-form per-module limit bag (e.g. { doctorLimit: 5, tokenLimitPerDay: 100,
  // appointmentLimit: 500 } for Hospital) — each module defines its own keys, see
  // ModuleEntitlementService.checkLimit.
  @IsOptional()
  @IsObject()
  limits?: Record<string, number | null>;

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;
}
