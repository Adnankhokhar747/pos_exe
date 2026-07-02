import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Doctor, DoctorSchedule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleEntitlementService } from '../module-entitlements/module-entitlement-status.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { UpsertDoctorScheduleDto } from './dto/upsert-doctor-schedule.dto';

const LINKED_USER_INCLUDE = {
  linkedUser: { select: { id: true, fullName: true, username: true } },
} as const;

export type DoctorWithLinkedUser = Doctor & {
  linkedUser: { id: string; fullName: string; username: string } | null;
};

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleEntitlementService: ModuleEntitlementService,
  ) {}

  list(tenantId: string, includeInactive = false): Promise<DoctorWithLinkedUser[]> {
    return this.prisma.doctor.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      include: LINKED_USER_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<DoctorWithLinkedUser> {
    const doctor = await this.prisma.doctor.findFirst({ where: { id, tenantId }, include: LINKED_USER_INCLUDE });
    if (!doctor) throw new NotFoundException(`Doctor ${id} not found.`);
    return doctor;
  }

  // For the Doctor form's "Linked User" picker — scoped to hospital.doctor.manage rather
  // than reusing GET /api/v1/users, which requires the separate user.manage permission a
  // Hospital Manager doesn't necessarily hold.
  async listLinkableUsers(tenantId: string): Promise<Array<{ id: string; fullName: string; username: string }>> {
    return this.prisma.user.findMany({
      where: { tenantId, status: 'active', doctorProfile: null },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateDoctorDto): Promise<DoctorWithLinkedUser> {
    const doctorCount = await this.prisma.doctor.count({ where: { tenantId } });
    await this.moduleEntitlementService.checkLimit(tenantId, 'hospital', 'doctorLimit', doctorCount);

    if (dto.linkedUserId) {
      await this.assertUserLinkable(tenantId, dto.linkedUserId);
    }

    return this.prisma.doctor.create({
      data: {
        tenantId,
        name: dto.name,
        specialization: dto.specialization,
        phone: dto.phone,
        email: dto.email,
        roomNumber: dto.roomNumber,
        consultationFee: dto.consultationFee ? new Prisma.Decimal(dto.consultationFee) : undefined,
        linkedUserId: dto.linkedUserId ?? null,
      },
      include: LINKED_USER_INCLUDE,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateDoctorDto): Promise<DoctorWithLinkedUser> {
    await this.findOne(tenantId, id);

    if (dto.linkedUserId) {
      await this.assertUserLinkable(tenantId, dto.linkedUserId, id);
    }

    return this.prisma.doctor.update({
      where: { id },
      data: {
        name: dto.name,
        specialization: dto.specialization,
        phone: dto.phone,
        email: dto.email,
        roomNumber: dto.roomNumber,
        consultationFee: dto.consultationFee ? new Prisma.Decimal(dto.consultationFee) : undefined,
        ...(dto.linkedUserId !== undefined ? { linkedUserId: dto.linkedUserId } : {}),
        isActive: dto.isActive,
      },
      include: LINKED_USER_INCLUDE,
    });
  }

  async deactivate(tenantId: string, id: string): Promise<DoctorWithLinkedUser> {
    await this.findOne(tenantId, id);
    return this.prisma.doctor.update({ where: { id }, data: { isActive: false }, include: LINKED_USER_INCLUDE });
  }

  async getSchedule(tenantId: string, doctorId: string): Promise<DoctorSchedule[]> {
    await this.findOne(tenantId, doctorId);
    return this.prisma.doctorSchedule.findMany({ where: { doctorId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
  }

  // Informational only — never consulted by appointment creation. Replace-all-rows
  // semantics: simplest correct model for a weekly schedule editor.
  async setSchedule(tenantId: string, doctorId: string, dto: UpsertDoctorScheduleDto): Promise<DoctorSchedule[]> {
    await this.findOne(tenantId, doctorId);
    return this.prisma.$transaction(async (tx) => {
      await tx.doctorSchedule.deleteMany({ where: { doctorId } });
      if (dto.slots.length === 0) return [];
      await tx.doctorSchedule.createMany({
        data: dto.slots.map((slot) => ({
          doctorId,
          dayOfWeek: slot.dayOfWeek as DoctorSchedule['dayOfWeek'],
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      });
      return tx.doctorSchedule.findMany({ where: { doctorId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    });
  }

  private async assertUserLinkable(tenantId: string, userId: string, excludeDoctorId?: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException(`User ${userId} not found.`);

    const existingLink = await this.prisma.doctor.findUnique({ where: { linkedUserId: userId } });
    if (existingLink && existingLink.id !== excludeDoctorId) {
      throw new ConflictException(`User ${userId} is already linked to another doctor.`);
    }
  }
}
