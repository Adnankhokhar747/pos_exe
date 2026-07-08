-- Add isDraft to appointment_bills (allows saving bill items before collecting payment)
ALTER TABLE "appointment_bills" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;

-- Make patient_balance nullable-equivalent via default (drafts don't know balance yet)
ALTER TABLE "appointment_bills" ALTER COLUMN "patient_balance" SET DEFAULT 0;

-- Link invoices to patients (for POS medical store purchases)
ALTER TABLE "invoices" ADD COLUMN "patient_id" TEXT;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
