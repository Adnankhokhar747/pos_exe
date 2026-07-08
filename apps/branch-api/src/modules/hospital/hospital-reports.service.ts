import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ZERO = new Prisma.Decimal(0);

export interface DoctorPatientCount {
  doctorId: string;
  doctorName: string;
  patientCount: number;
}

export interface DoctorRevenueSummary {
  doctorId: string;
  doctorName: string;
  consultationRevenue: string;
  appointmentCount: number;
}

export interface HospitalRevenueSummary {
  totalConsultationRevenue: string;
  totalMedicineRevenue: string;
  totalRevenue: string;
  totalAdvanceCollected: string;
  totalRefunded: string;
  byDoctor: DoctorRevenueSummary[];
}

export interface DoctorAppointmentSummary {
  doctorId: string;
  doctorName: string;
  walkInCount: number;
  advanceBookingCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class HospitalReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Distinct patients seen (completed appointments) on a given day, per doctor —
  // mirrors ReportsService's findMany + in-memory aggregation pattern (no raw SQL).
  async dailyPatients(tenantId: string, date: Date, doctorId?: string): Promise<DoctorPatientCount[]> {
    return this.patientCountsFor(tenantId, toDateOnly(date), toDateOnly(date), doctorId);
  }

  async monthlyPatients(tenantId: string, year: number, month: number, doctorId?: string): Promise<DoctorPatientCount[]> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));
    return this.patientCountsFor(tenantId, from, to, doctorId);
  }

  private async patientCountsFor(
    tenantId: string,
    from: Date,
    to: Date,
    doctorId?: string,
  ): Promise<DoctorPatientCount[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        status: 'completed',
        appointmentDate: { gte: from, lte: to },
        ...(doctorId ? { doctorId } : {}),
      },
      select: { doctorId: true, patientId: true, doctor: { select: { name: true } } },
    });

    const byDoctor = new Map<string, { doctorName: string; patientIds: Set<string> }>();
    for (const appointment of appointments) {
      const entry = byDoctor.get(appointment.doctorId) ?? {
        doctorName: appointment.doctor.name,
        patientIds: new Set<string>(),
      };
      entry.patientIds.add(appointment.patientId);
      byDoctor.set(appointment.doctorId, entry);
    }

    return Array.from(byDoctor.entries()).map(([id, data]) => ({
      doctorId: id,
      doctorName: data.doctorName,
      patientCount: data.patientIds.size,
    }));
  }

  async summary(tenantId: string, from: Date, to: Date, doctorId?: string): Promise<DoctorAppointmentSummary[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        appointmentDate: { gte: toDateOnly(from), lte: toDateOnly(to) },
        ...(doctorId ? { doctorId } : {}),
      },
      select: { doctorId: true, status: true, appointmentType: true, doctor: { select: { name: true } } },
    });

    const byDoctor = new Map<string, DoctorAppointmentSummary>();
    for (const appointment of appointments) {
      const entry =
        byDoctor.get(appointment.doctorId) ??
        ({
          doctorId: appointment.doctorId,
          doctorName: appointment.doctor.name,
          walkInCount: 0,
          advanceBookingCount: 0,
          completedCount: 0,
          cancelledCount: 0,
          noShowCount: 0,
        } as DoctorAppointmentSummary);

      if (appointment.appointmentType === 'walk_in') entry.walkInCount += 1;
      if (appointment.appointmentType === 'advance') entry.advanceBookingCount += 1;
      if (appointment.status === 'completed') entry.completedCount += 1;
      if (appointment.status === 'cancelled') entry.cancelledCount += 1;
      if (appointment.status === 'no_show') entry.noShowCount += 1;

      byDoctor.set(appointment.doctorId, entry);
    }

    return Array.from(byDoctor.values());
  }

  // Fills the gap where hospital revenue (consultation fees, medicine sold as part
  // of an appointment bill) was invisible to every financial report — accounting
  // .service.ts's profit/sales summaries only ever look at POS Invoice rows, and
  // AppointmentBill data has no branchId to slot into those branch-scoped queries
  // anyway (hospital data is tenant-wide, not per-branch). This is a parallel,
  // tenant-wide revenue view rather than forcing it into the branch-scoped shape.
  async revenue(tenantId: string, from: Date, to: Date): Promise<HospitalRevenueSummary> {
    const bills = await this.prisma.appointmentBill.findMany({
      where: { tenantId, isDraft: false, finalizedAt: { gte: from, lte: to } },
      select: {
        consultationFee: true,
        medicineTotal: true,
        appointment: { select: { doctorId: true, doctor: { select: { name: true } } } },
      },
    });

    let totalConsultationRevenue = ZERO;
    let totalMedicineRevenue = ZERO;
    const byDoctor = new Map<string, DoctorRevenueSummary & { _consultation: Prisma.Decimal }>();

    for (const bill of bills) {
      totalConsultationRevenue = totalConsultationRevenue.add(bill.consultationFee);
      totalMedicineRevenue = totalMedicineRevenue.add(bill.medicineTotal);

      const doctorId = bill.appointment.doctorId;
      const entry = byDoctor.get(doctorId) ?? {
        doctorId,
        doctorName: bill.appointment.doctor.name,
        consultationRevenue: '0',
        appointmentCount: 0,
        _consultation: ZERO,
      };
      entry._consultation = entry._consultation.add(bill.consultationFee);
      entry.appointmentCount += 1;
      byDoctor.set(doctorId, entry);
    }

    const [advanceAgg, refundAgg] = await Promise.all([
      this.prisma.patientLedgerEntry.aggregate({
        where: { tenantId, entryType: 'advance', occurredAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.patientLedgerEntry.aggregate({
        where: { tenantId, entryType: 'refund', occurredAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalConsultationRevenue: totalConsultationRevenue.toFixed(2),
      totalMedicineRevenue: totalMedicineRevenue.toFixed(2),
      totalRevenue: totalConsultationRevenue.add(totalMedicineRevenue).toFixed(2),
      totalAdvanceCollected: (advanceAgg._sum.amount ?? ZERO).toFixed(2),
      // Refund entries are stored as negative amounts (they reduce the balance) —
      // negate back to a positive figure for display ("we refunded $X total").
      totalRefunded: (refundAgg._sum.amount ?? ZERO).neg().toFixed(2),
      byDoctor: Array.from(byDoctor.values()).map(({ _consultation, ...rest }) => ({
        ...rest,
        consultationRevenue: _consultation.toFixed(2),
      })),
    };
  }
}
