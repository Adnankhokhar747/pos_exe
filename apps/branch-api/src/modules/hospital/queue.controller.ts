import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AppointmentsService, QueueStatus } from './appointments.service';
import { HospitalScopeService } from './hospital-scope.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { ModuleGuard } from '../module-entitlements/module.guard';
import { RequireModule } from '../module-entitlements/require-module.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/hospital/queue')
@UseGuards(JwtAuthGuard, LicenseGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hospital')
export class QueueController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly hospitalScopeService: HospitalScopeService,
  ) {}

  // No @RequirePermission — any authenticated Hospital-module user can view the queue
  // display, including Doctor-role users checking their own queue (same posture as
  // Customers' open GET /).
  @Get()
  async getQueueStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
  ): Promise<QueueStatus> {
    const scope = await this.hospitalScopeService.resolveDoctorScope(user);
    // Defense in depth: a scoped Doctor-role user's own doctorId always wins over the
    // query param, so they can't view another doctor's queue by tampering the query string.
    const effectiveDoctorId = scope.viewAll ? doctorId : scope.doctorId;
    if (!effectiveDoctorId) throw new BadRequestException('doctorId is required.');

    return this.appointmentsService.getQueueStatus(user.tenantId, effectiveDoctorId, date ? new Date(date) : new Date());
  }
}
