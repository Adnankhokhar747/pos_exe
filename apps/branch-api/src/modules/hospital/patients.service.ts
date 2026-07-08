import { Injectable, NotFoundException } from '@nestjs/common';
import { Patient, PatientLedgerEntry, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { RecordAdvanceDto } from './dto/record-advance.dto';
import { RefundPatientDto } from './dto/refund-patient.dto';
import { SettleTreatmentDto } from './dto/settle-treatment.dto';
import { InvalidPatientAdvancePaymentError, RefundExceedsBalanceError } from '../../common/exceptions/domain-exception';

export interface SettlementResult {
  patient: Patient;
  action: 'refunded' | 'collected' | 'none';
  amount: string;
}

const ZERO = new Prisma.Decimal(0);

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

  async recordAdvance(
    tenantId: string,
    patientId: string,
    createdBy: string,
    dto: RecordAdvanceDto,
  ): Promise<PatientLedgerEntry> {
    const totalAmount = dto.payments.reduce((sum, p) => sum.add(p.amount), ZERO);
    if (totalAmount.lessThanOrEqualTo(0)) {
      throw new InvalidPatientAdvancePaymentError('Advance payment total must be greater than zero.');
    }
    const methodsSummary = dto.payments
      .map((p) => `${p.amount} via ${p.method}${p.reference ? ` (${p.reference})` : ''}`)
      .join(', ');
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findFirst({ where: { id: patientId, tenantId } });
      if (!patient) throw new NotFoundException('Patient not found');
      const newBalance = patient.currentBalance.add(totalAmount);
      await tx.patient.update({ where: { id: patientId }, data: { currentBalance: newBalance } });
      return tx.patientLedgerEntry.create({
        data: {
          tenantId,
          patientId,
          entryType: 'advance',
          amount: totalAmount,
          balanceAfter: newBalance,
          description: dto.notes ?? `Advance deposit: ${methodsSummary}`,
          createdBy,
        },
      });
    });
  }

  // Manual, staff-initiated refund of some or all of a patient's advance balance —
  // previously the only way money ever flowed back out was as a side-effect of
  // voiding a POS sale. Amount is capped at the current balance so this can never
  // push the balance negative.
  async refund(tenantId: string, patientId: string, createdBy: string, dto: RefundPatientDto): Promise<PatientLedgerEntry> {
    const amount = new Prisma.Decimal(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findFirst({ where: { id: patientId, tenantId } });
      if (!patient) throw new NotFoundException(`Patient ${patientId} not found.`);
      if (amount.greaterThan(patient.currentBalance)) {
        throw new RefundExceedsBalanceError(patient.currentBalance.toFixed(2), amount.toFixed(2));
      }

      const newBalance = patient.currentBalance.sub(amount);
      await tx.patient.update({ where: { id: patientId }, data: { currentBalance: newBalance } });
      return tx.patientLedgerEntry.create({
        data: {
          tenantId,
          patientId,
          entryType: 'refund',
          amount: amount.neg(),
          balanceAfter: newBalance,
          description: dto.notes ?? `Refund via ${dto.method}${dto.reference ? ` (${dto.reference})` : ''}`,
          createdBy,
        },
      });
    });
  }

  // "Complete Treatment": settles whatever is left on the patient's advance
  // balance in one step — refunds it back if positive, or collects the shortfall
  // if somehow negative. In practice every path that deducts from the balance
  // (appointment billing, POS patient-advance payments) already clamps the
  // deduction to the available balance, so "collected" should be rare/never in
  // normal operation — handled anyway so this is correct even if that invariant
  // is ever relaxed, rather than silently going negative forever.
  async settleTreatment(
    tenantId: string,
    patientId: string,
    createdBy: string,
    dto: SettleTreatmentDto,
  ): Promise<SettlementResult> {
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findFirst({ where: { id: patientId, tenantId } });
      if (!patient) throw new NotFoundException(`Patient ${patientId} not found.`);

      const balance = patient.currentBalance;
      if (balance.isZero()) {
        return { patient, action: 'none' as const, amount: '0.00' };
      }

      if (balance.greaterThan(0)) {
        const updated = await tx.patient.update({ where: { id: patientId }, data: { currentBalance: ZERO } });
        await tx.patientLedgerEntry.create({
          data: {
            tenantId,
            patientId,
            entryType: 'refund',
            amount: balance.neg(),
            balanceAfter: ZERO,
            description: `Treatment completed — advance balance refunded via ${dto.method}`,
            createdBy,
          },
        });
        return { patient: updated, action: 'refunded' as const, amount: balance.toFixed(2) };
      }

      const owed = balance.neg();
      const updated = await tx.patient.update({ where: { id: patientId }, data: { currentBalance: ZERO } });
      await tx.patientLedgerEntry.create({
        data: {
          tenantId,
          patientId,
          entryType: 'advance',
          amount: owed,
          balanceAfter: ZERO,
          description: `Treatment completed — final payment collected via ${dto.method}`,
          createdBy,
        },
      });
      return { patient: updated, action: 'collected' as const, amount: owed.toFixed(2) };
    });
  }

  getLedger(tenantId: string, patientId: string): Promise<PatientLedgerEntry[]> {
    return this.prisma.patientLedgerEntry.findMany({
      where: { tenantId, patientId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async getPatientPosInvoices(tenantId: string, patientId: string) {
    await this.findOne(tenantId, patientId);
    return this.prisma.invoice.findMany({
      where: { patientId, status: 'completed' },
      include: {
        lines: {
          include: { product: { select: { name: true } } },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
