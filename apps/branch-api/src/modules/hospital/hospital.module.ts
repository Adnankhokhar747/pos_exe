import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { QueueController } from './queue.controller';
import { TokenSequenceService } from './token-sequence.service';
import { HospitalScopeService } from './hospital-scope.service';
import { HospitalReportsController } from './hospital-reports.controller';
import { HospitalReportsService } from './hospital-reports.service';
import { LicensingModule } from '../licensing/licensing.module';
import { ModuleEntitlementsModule } from '../module-entitlements/module-entitlements.module';

// Registers its own JwtModule for the same reason LicensingModule/ModuleEntitlementsModule
// do — JwtAuthGuard must resolve wherever this module is imported standalone.
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
    LicensingModule,
    ModuleEntitlementsModule,
  ],
  controllers: [DoctorsController, PatientsController, AppointmentsController, QueueController, HospitalReportsController],
  providers: [
    DoctorsService,
    PatientsService,
    AppointmentsService,
    TokenSequenceService,
    HospitalScopeService,
    HospitalReportsService,
  ],
  exports: [DoctorsService, PatientsService, AppointmentsService, TokenSequenceService, HospitalScopeService],
})
export class HospitalModule {}
