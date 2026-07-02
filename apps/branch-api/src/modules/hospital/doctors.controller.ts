import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DoctorSchedule } from '@prisma/client';
import { DoctorsService, DoctorWithLinkedUser } from './doctors.service';
import { AppointmentsService } from './appointments.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { UpsertDoctorScheduleDto } from './dto/upsert-doctor-schedule.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { ModuleGuard } from '../module-entitlements/module.guard';
import { RequireModule } from '../module-entitlements/require-module.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/hospital/doctors')
@UseGuards(JwtAuthGuard, LicenseGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hospital')
export class DoctorsController {
  constructor(
    private readonly doctorsService: DoctorsService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<DoctorWithLinkedUser[]> {
    return this.doctorsService.list(user.tenantId, includeInactive === 'true');
  }

  @Get('linkable-users')
  @RequirePermission('hospital.doctor.manage')
  listLinkableUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.doctorsService.listLinkableUsers(user.tenantId);
  }

  @Post()
  @RequirePermission('hospital.doctor.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDoctorDto): Promise<DoctorWithLinkedUser> {
    return this.doctorsService.create(user.tenantId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<DoctorWithLinkedUser> {
    return this.doctorsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('hospital.doctor.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
  ): Promise<DoctorWithLinkedUser> {
    return this.doctorsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('hospital.doctor.manage')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<DoctorWithLinkedUser> {
    return this.doctorsService.deactivate(user.tenantId, id);
  }

  @Get(':id/schedule')
  getSchedule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<DoctorSchedule[]> {
    return this.doctorsService.getSchedule(user.tenantId, id);
  }

  @Patch(':id/schedule')
  @RequirePermission('hospital.doctor.manage')
  setSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertDoctorScheduleDto,
  ): Promise<DoctorSchedule[]> {
    return this.doctorsService.setSchedule(user.tenantId, id, dto);
  }

  @Get(':id/appointments')
  getAppointmentHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.listForDoctor(user.tenantId, id);
  }
}
