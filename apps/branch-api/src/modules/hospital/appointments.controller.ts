import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Appointment, AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { HospitalScopeService } from './hospital-scope.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { ModuleGuard } from '../module-entitlements/module.guard';
import { RequireModule } from '../module-entitlements/require-module.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/hospital/appointments')
@UseGuards(JwtAuthGuard, LicenseGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hospital')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly hospitalScopeService: HospitalScopeService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('appointmentType') appointmentType?: 'walk_in' | 'advance',
  ): Promise<Appointment[]> {
    const scope = await this.hospitalScopeService.resolveDoctorScope(user);
    return this.appointmentsService.list(user.tenantId, scope, { doctorId, date, status, appointmentType });
  }

  @Post()
  @RequirePermission('hospital.appointment.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAppointmentDto): Promise<Appointment> {
    return this.appointmentsService.create(user.tenantId, dto);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Appointment> {
    const scope = await this.hospitalScopeService.resolveDoctorScope(user);
    return this.appointmentsService.findOne(user.tenantId, id, scope);
  }

  @Patch(':id/status')
  @RequirePermission('hospital.appointment.manage')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ): Promise<Appointment> {
    const scope = await this.hospitalScopeService.resolveDoctorScope(user);
    return this.appointmentsService.updateStatus(user.tenantId, id, scope, dto.status, dto.cancelReason);
  }
}
