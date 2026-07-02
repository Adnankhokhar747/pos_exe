import { Injectable, NotFoundException } from '@nestjs/common';
import { Patient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, search?: string, includeInactive = false): Promise<Patient[]> {
    return this.prisma.patient.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async findOne(tenantId: string, id: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({ where: { id, tenantId } });
    if (!patient) throw new NotFoundException(`Patient ${id} not found.`);
    return patient;
  }

  create(tenantId: string, dto: CreatePatientDto): Promise<Patient> {
    return this.prisma.patient.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePatientDto): Promise<Patient> {
    await this.findOne(tenantId, id);
    return this.prisma.patient.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
        isActive: dto.isActive,
      },
    });
  }

  async deactivate(tenantId: string, id: string): Promise<Patient> {
    await this.findOne(tenantId, id);
    return this.prisma.patient.update({ where: { id }, data: { isActive: false } });
  }
}
