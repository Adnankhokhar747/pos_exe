import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DoctorScope } from './hospital-scope.service';
import { AppointmentsService } from './appointments.service';
import { FinalizeBillDto } from './dto/finalize-bill.dto';
import { SaveDraftBillDto } from './dto/save-draft-bill.dto';
import {
  AppointmentNotBillableError,
  BillAlreadyFinalizedError,
  InsufficientPatientBalanceError,
  UnderpaidBillError,
} from '../../common/exceptions/domain-exception';

@Injectable()
export class AppointmentBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async saveDraft(
    tenantId: string,
    appointmentId: string,
    savedBy: string,
    scope: DoctorScope,
    dto: SaveDraftBillDto,
  ) {
    const appointment = await this.appointmentsService.findOne(tenantId, appointmentId, scope);
    if (appointment.status !== 'confirmed') throw new AppointmentNotBillableError(appointment.status);

    const appt = appointment as any;
    const medicineTotal = dto.medicineLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const totalDue = dto.consultationFee + medicineTotal;

    const lineData = [
      {
        lineType: 'consultation',
        description: `Consultation — ${appt.doctor?.name ?? 'Doctor'}`,
        quantity: 1,
        unitPrice: dto.consultationFee,
        lineTotal: dto.consultationFee,
      },
      ...dto.medicineLines.map((l) => ({
        lineType: 'medicine',
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.quantity * l.unitPrice,
      })),
    ];

    const existing = await this.prisma.appointmentBill.findUnique({ where: { appointmentId } });

    if (existing) {
      if (!existing.isDraft) throw new BillAlreadyFinalizedError();
      return this.prisma.$transaction(async (tx) => {
        await tx.appointmentBillLine.deleteMany({ where: { billId: existing.id } });
        return tx.appointmentBill.update({
          where: { id: existing.id },
          data: {
            consultationFee: dto.consultationFee,
            medicineTotal,
            totalDue,
            notes: dto.notes,
            finalizedBy: savedBy,
            lines: { create: lineData },
          },
          include: { lines: true, payments: true },
        });
      });
    }

    return this.prisma.appointmentBill.create({
      data: {
        tenantId,
        appointmentId,
        isDraft: true,
        consultationFee: dto.consultationFee,
        medicineTotal,
        totalDue,
        advanceApplied: 0,
        totalCollected: 0,
        advanceCredited: 0,
        patientBalance: 0,
        notes: dto.notes,
        finalizedBy: savedBy,
        lines: { create: lineData },
      },
      include: { lines: true, payments: true },
    });
  }

  async finalizeBill(
    tenantId: string,
    appointmentId: string,
    finalizedBy: string,
    scope: DoctorScope,
    dto: FinalizeBillDto,
  ) {
    const appointment = await this.appointmentsService.findOne(tenantId, appointmentId, scope);
    if (appointment.status !== 'confirmed') throw new AppointmentNotBillableError(appointment.status);

    const existing = await this.prisma.appointmentBill.findUnique({ where: { appointmentId } });
    if (existing && !existing.isDraft) throw new BillAlreadyFinalizedError();

    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id: appointment.patientId } });
    const patientBalance = Number(patient.currentBalance);

    const medicineTotal = dto.medicineLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const totalDue = dto.consultationFee + medicineTotal;

    if (dto.advanceApplied > patientBalance) {
      throw new InsufficientPatientBalanceError(patientBalance.toFixed(2), dto.advanceApplied.toFixed(2));
    }

    const advanceApplied = Math.min(dto.advanceApplied, patientBalance, totalDue);
    const remainingDue = totalDue - advanceApplied;
    const totalCollected = dto.payments.reduce((s, p) => s + p.amount, 0);
    // Overpayment isn't handed back as cash change — it's credited to the patient's advance balance.
    const advanceCredited = Math.max(0, totalCollected - remainingDue);
    const netCollected = totalCollected - advanceCredited;

    if (netCollected + advanceApplied < totalDue - 0.001) {
      throw new UnderpaidBillError(totalDue.toFixed(2), (netCollected + advanceApplied).toFixed(2));
    }

    const patientBalanceAfter = patientBalance - advanceApplied + advanceCredited;
    const now = new Date();
    const appt = appointment as any;

    const lineData = [
      {
        lineType: 'consultation',
        description: `Consultation — ${appt.doctor?.name ?? 'Doctor'}`,
        quantity: 1,
        unitPrice: dto.consultationFee,
        lineTotal: dto.consultationFee,
      },
      ...dto.medicineLines.map((l) => ({
        lineType: 'medicine',
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.quantity * l.unitPrice,
      })),
    ];

    const paymentData = dto.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference,
    }));

    return this.prisma.$transaction(async (tx) => {
      let bill;

      if (existing) {
        // Finalize existing draft
        await tx.appointmentBillLine.deleteMany({ where: { billId: existing.id } });
        await tx.appointmentBillPayment.deleteMany({ where: { billId: existing.id } });
        bill = await tx.appointmentBill.update({
          where: { id: existing.id },
          data: {
            isDraft: false,
            consultationFee: dto.consultationFee,
            medicineTotal,
            totalDue,
            advanceApplied,
            totalCollected: netCollected,
            advanceCredited,
            patientBalance: patientBalanceAfter,
            notes: dto.notes,
            finalizedBy,
            finalizedAt: now,
            lines: { create: lineData },
            payments: { create: paymentData },
          },
          include: { lines: true, payments: true },
        });
      } else {
        bill = await tx.appointmentBill.create({
          data: {
            tenantId,
            appointmentId,
            isDraft: false,
            consultationFee: dto.consultationFee,
            medicineTotal,
            totalDue,
            advanceApplied,
            totalCollected: netCollected,
            advanceCredited,
            patientBalance: patientBalanceAfter,
            notes: dto.notes,
            finalizedBy,
            finalizedAt: now,
            lines: { create: lineData },
            payments: { create: paymentData },
          },
          include: { lines: true, payments: true },
        });
      }

      await tx.patient.update({
        where: { id: appointment.patientId },
        data: { currentBalance: patientBalanceAfter },
      });

      if (advanceApplied > 0) {
        const parts: string[] = [`Consultation fee: ${dto.consultationFee}`];
        if (medicineTotal > 0) parts.push(`clinic charges: ${medicineTotal}`);
        await tx.patientLedgerEntry.create({
          data: {
            tenantId,
            patientId: appointment.patientId,
            appointmentId,
            entryType: 'charge',
            amount: -advanceApplied,
            balanceAfter: patientBalanceAfter - advanceCredited,
            description: `Advance deducted — Token #${appointment.tokenNumber} (${parts.join(', ')})`,
            createdBy: finalizedBy,
          },
        });
      }

      if (advanceCredited > 0) {
        await tx.patientLedgerEntry.create({
          data: {
            tenantId,
            patientId: appointment.patientId,
            appointmentId,
            entryType: 'advance',
            amount: advanceCredited,
            balanceAfter: patientBalanceAfter,
            description: `Advance credited from overpayment — Token #${appointment.tokenNumber}`,
            createdBy: finalizedBy,
          },
        });
      }

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'completed', completedAt: now },
      });

      return bill;
    });
  }

  async getBill(tenantId: string, appointmentId: string, scope: DoctorScope) {
    await this.appointmentsService.findOne(tenantId, appointmentId, scope);
    return this.prisma.appointmentBill.findUnique({
      where: { appointmentId },
      include: {
        lines: { include: { product: { select: { id: true, name: true } } } },
        payments: true,
      },
    });
  }
}
