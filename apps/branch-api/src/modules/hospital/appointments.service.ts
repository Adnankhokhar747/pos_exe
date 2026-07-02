import { Injectable, NotFoundException } from '@nestjs/common';
import { Appointment, AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleEntitlementService } from '../module-entitlements/module-entitlement-status.service';
import { TokenSequenceService } from './token-sequence.service';
import { DoctorScope } from './hospital-scope.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { InvalidAppointmentStatusTransitionError } from '../../common/exceptions/domain-exception';

export interface QueueStatus {
  currentToken: number;
  nextToken: number | null;
  waitingCount: number;
  completedCount: number;
}

const APPOINTMENT_INCLUDE = { doctor: true, patient: true } as const;

// Legal status transitions: booked -> confirmed/cancelled; confirmed -> completed/no_show;
// completed/cancelled/no_show are terminal. Walk-ins skip "booked" entirely (token issued
// = patient physically present, so they start at "confirmed").
const LEGAL_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleEntitlementService: ModuleEntitlementService,
    private readonly tokenSequenceService: TokenSequenceService,
  ) {}

  async create(tenantId: string, dto: CreateAppointmentDto): Promise<Appointment> {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, tenantId } });
    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found.`);
    const doctor = await this.prisma.doctor.findFirst({ where: { id: dto.doctorId, tenantId } });
    if (!doctor) throw new NotFoundException(`Doctor ${dto.doctorId} not found.`);

    const appointmentDate =
      dto.appointmentType === 'advance' && dto.appointmentDate
        ? toDateOnly(new Date(dto.appointmentDate))
        : toDateOnly(new Date());

    const lifetimeCount = await this.prisma.appointment.count({ where: { tenantId } });
    await this.moduleEntitlementService.checkLimit(tenantId, 'hospital', 'appointmentLimit', lifetimeCount);

    const dailyCount = await this.prisma.appointment.count({ where: { tenantId, appointmentDate } });
    await this.moduleEntitlementService.checkLimit(tenantId, 'hospital', 'tokenLimitPerDay', dailyCount);

    const isWalkIn = dto.appointmentType === 'walk_in';
    const now = new Date();

    return this.tokenSequenceService.issueToken(dto.doctorId, appointmentDate, (tokenNumber, tx) =>
      tx.appointment.create({
        data: {
          tenantId,
          doctorId: dto.doctorId,
          patientId: dto.patientId,
          appointmentType: dto.appointmentType,
          status: isWalkIn ? 'confirmed' : 'booked',
          appointmentDate,
          tokenNumber,
          arrivedAt: isWalkIn ? now : null,
          notes: dto.notes,
        },
        include: APPOINTMENT_INCLUDE,
      }),
    );
  }

  async list(
    tenantId: string,
    scope: DoctorScope,
    filters: { doctorId?: string; date?: string; status?: AppointmentStatus; appointmentType?: 'walk_in' | 'advance' },
  ) {
    const effectiveDoctorId = scope.viewAll ? filters.doctorId : scope.doctorId ?? '__none__';
    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        ...(effectiveDoctorId ? { doctorId: effectiveDoctorId } : {}),
        ...(filters.date ? { appointmentDate: toDateOnly(new Date(filters.date)) } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.appointmentType ? { appointmentType: filters.appointmentType } : {}),
      },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
      take: 500,
    });
  }

  listForDoctor(tenantId: string, doctorId: string) {
    return this.prisma.appointment.findMany({
      where: { tenantId, doctorId },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
      take: 500,
    });
  }

  listForPatient(tenantId: string, patientId: string) {
    return this.prisma.appointment.findMany({
      where: { tenantId, patientId },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
      take: 500,
    });
  }

  async findOne(tenantId: string, id: string, scope: DoctorScope): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundException(`Appointment ${id} not found.`);
    if (!scope.viewAll && appointment.doctorId !== scope.doctorId) {
      throw new NotFoundException(`Appointment ${id} not found.`);
    }
    return appointment;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    scope: DoctorScope,
    status: AppointmentStatus,
    cancelReason?: string,
  ): Promise<Appointment> {
    const appointment = await this.findOne(tenantId, id, scope);
    const legalNextStates = LEGAL_TRANSITIONS[appointment.status];
    if (!legalNextStates.includes(status)) {
      throw new InvalidAppointmentStatusTransitionError(appointment.status, status);
    }

    const now = new Date();
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status,
        cancelReason: status === 'cancelled' ? cancelReason : undefined,
        arrivedAt: status === 'confirmed' ? now : undefined,
        completedAt: status === 'completed' ? now : undefined,
        cancelledAt: status === 'cancelled' ? now : undefined,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  // Computed live from Appointment rows every call — no separate counter to keep in
  // sync, and it stays consistent with token issuance by construction (same source
  // of truth TokenSequenceService reads from).
  async getQueueStatus(tenantId: string, doctorId: string, date: Date): Promise<QueueStatus> {
    const appointments = await this.prisma.appointment.findMany({
      where: { tenantId, doctorId, appointmentDate: toDateOnly(date) },
      orderBy: { tokenNumber: 'asc' },
    });
    const completed = appointments.filter((a) => a.status === 'completed');
    const waiting = appointments.filter((a) => a.status === 'confirmed' || a.status === 'booked');
    const currentToken = completed.length > 0 ? Math.max(...completed.map((a) => a.tokenNumber)) : 0;
    const nextToken = waiting.length > 0 ? Math.min(...waiting.map((a) => a.tokenNumber)) : null;
    return { currentToken, nextToken, waitingCount: waiting.length, completedCount: completed.length };
  }
}
