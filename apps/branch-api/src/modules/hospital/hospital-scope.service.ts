import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/auth/types';

export interface DoctorScope {
  doctorId: string | null;
  viewAll: boolean;
}

// A Doctor-role user must only ever see their own queue/appointments — this is RBAC
// row-level scoping, not just a permission flag (mirrors how pos.sale.viewAll already
// distinguishes "own sales only" vs "all sales" for Cashier vs Company Admin/Accountant).
// Receptionists are NOT linked to a Doctor record, so they are never scoped — front-desk
// staff need cross-doctor visibility per the spec ("Receptionist: token + appointments"),
// and what's withheld from them is the hospital.doctor.manage/report.view permissions,
// not row-level doctor scoping.
@Injectable()
export class HospitalScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDoctorScope(user: AuthenticatedUser): Promise<DoctorScope> {
    if (user.permissions.includes('hospital.appointment.viewAll')) {
      return { doctorId: null, viewAll: true };
    }

    const doctor = await this.prisma.doctor.findUnique({ where: { linkedUserId: user.userId } });
    if (doctor) {
      return { doctorId: doctor.id, viewAll: false };
    }

    // No linked Doctor record and no viewAll permission (e.g. a Receptionist) — not
    // scoped, since they need cross-doctor visibility for front-desk work.
    return { doctorId: null, viewAll: true };
  }
}
