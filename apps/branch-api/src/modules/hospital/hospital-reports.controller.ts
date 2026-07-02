import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DoctorAppointmentSummary, DoctorPatientCount, HospitalReportsService } from './hospital-reports.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { ModuleGuard } from '../module-entitlements/module.guard';
import { RequireModule } from '../module-entitlements/require-module.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/hospital/reports')
@UseGuards(JwtAuthGuard, LicenseGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hospital')
@RequirePermission('hospital.report.view')
export class HospitalReportsController {
  constructor(private readonly hospitalReportsService: HospitalReportsService) {}

  @Get('daily-patients')
  dailyPatients(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date: string,
    @Query('doctorId') doctorId?: string,
  ): Promise<DoctorPatientCount[]> {
    return this.hospitalReportsService.dailyPatients(user.tenantId, new Date(date), doctorId);
  }

  @Get('monthly-patients')
  monthlyPatients(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month: string,
    @Query('doctorId') doctorId?: string,
  ): Promise<DoctorPatientCount[]> {
    const [yearStr, monthStr] = month.split('-');
    return this.hospitalReportsService.monthlyPatients(user.tenantId, Number(yearStr), Number(monthStr), doctorId);
  }

  @Get('summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ): Promise<DoctorAppointmentSummary[]> {
    return this.hospitalReportsService.summary(user.tenantId, new Date(from), new Date(to), doctorId);
  }
}
