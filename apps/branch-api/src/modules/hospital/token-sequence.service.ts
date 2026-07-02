import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenIssuanceConflictError } from '../../common/exceptions/domain-exception';

const MAX_ATTEMPTS = 15;
// P2002: unique-constraint violation (two transactions computed the same tokenNumber
// and both tried to insert it). P2034: Prisma's own code for "transaction failed due
// to a write conflict or a deadlock" — what Postgres SERIALIZABLE actually raises for
// most concurrent conflicts under this workload (not the raw "40001" SQLSTATE, which
// Prisma doesn't surface as a bare string on the error).
const RETRYABLE_CODES = new Set(['P2002', 'P2034']);

function isRetryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_CODES.has(error.code);
}

// Each doctor has an independent token sequence per calendar day, derived live from
// Appointment.tokenNumber (max+1) rather than a separate counter table — keeps token
// numbering fully derived from Appointment rows with no parallel state to drift out of
// sync (the Queue Dashboard reads the same rows). A doctor's queue is a single hot row
// contended by receptionists issuing walk-in tokens seconds apart, multiplied by N
// doctors — meaningfully higher contention than the existing lifetime invoice-numbering
// precedent (count+1, no transaction), so this needs real concurrency safety: Serializable
// isolation plus retry-on-conflict, backed by @@unique([doctorId, appointmentDate, tokenNumber]).
@Injectable()
export class TokenSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async issueToken<T>(
    doctorId: string,
    appointmentDate: Date,
    createWithToken: (tokenNumber: number, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const result = await tx.appointment.aggregate({
              where: { doctorId, appointmentDate },
              _max: { tokenNumber: true },
            });
            const nextTokenNumber = (result._max.tokenNumber ?? 0) + 1;
            return createWithToken(nextTokenNumber, tx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isRetryable(error)) throw error;
        // Bounded retries always degrade to a clean, documented error rather than a
        // raw Prisma exception leaking out as an unhandled 500 — the receptionist UI
        // can show this and let the user just press the button again.
        if (attempt === MAX_ATTEMPTS) throw new TokenIssuanceConflictError();
        // Small random backoff so retries from a burst of colliding transactions don't
        // all immediately re-collide on the same row again.
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 * attempt + 10));
      }
    }
    throw new TokenIssuanceConflictError();
  }
}
