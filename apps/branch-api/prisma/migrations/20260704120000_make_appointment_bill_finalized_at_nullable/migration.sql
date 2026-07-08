ALTER TABLE "appointment_bills" ALTER COLUMN "finalized_at" DROP NOT NULL;
ALTER TABLE "appointment_bills" ALTER COLUMN "finalized_at" DROP DEFAULT;
