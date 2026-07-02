import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DoctorPatientCount {
  doctorId: string;
  doctorName: string;
  patientCount: number;
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
}
