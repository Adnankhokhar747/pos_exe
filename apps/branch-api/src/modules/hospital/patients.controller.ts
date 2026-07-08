import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Patient } from '@prisma/client';
import { PatientsService } from './patients.service';
import { AppointmentsService } from './appointments.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { RecordAdvanceDto } from './dto/record-advance.dto';
import { RefundPatientDto } from './dto/refund-patient.dto';
import { SettleTreatmentDto } from './dto/settle-treatment.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { ModuleGuard } from '../module-entitlements/module.guard';
import { RequireModule } from '../module-entitlements/require-module.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/hospital/patients')
@UseGuards(JwtAuthGuard, LicenseGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hospital')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<Patient[]> {
    return this.patientsService.list(user.tenantId, search, includeInactive === 'true');
  }

  @Post()
  @RequirePermission('hospital.patient.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePatientDto): Promise<Patient> {
    return this.patientsService.create(user.tenantId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Patient> {
    return this.patientsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('hospital.patient.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ): Promise<Patient> {
    return this.patientsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('hospital.patient.manage')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Patient> {
    return this.patientsService.deactivate(user.tenantId, id);
  }

  @Get(':id/appointments')
  getAppointmentHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.listForPatient(user.tenantId, id);
  }

  @Post(':id/advance')
  @RequirePermission('hospital.patient.manage')
  recordAdvance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordAdvanceDto,
  ) {
    return this.patientsService.recordAdvance(user.tenantId, id, user.userId, dto);
  }

  @Post(':id/refund')
  @RequirePermission('hospital.patient.manage')
  refund(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RefundPatientDto) {
    return this.patientsService.refund(user.tenantId, id, user.userId, dto);
  }

  @Post(':id/settle-treatment')
  @RequirePermission('hospital.patient.manage')
  settleTreatment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SettleTreatmentDto) {
    return this.patientsService.settleTreatment(user.tenantId, id, user.userId, dto);
  }

  @Get(':id/ledger')
  getLedger(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patientsService.getLedger(user.tenantId, id);
  }

  @Get(':id/pos-invoices')
  getPosInvoices(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patientsService.getPatientPosInvoices(user.tenantId, id);
  }
}
