-- Overpayment on an appointment bill is now credited to the patient's advance
-- balance instead of being handed back as physical cash change.
ALTER TABLE "appointment_bills" RENAME COLUMN "change_given" TO "advance_credited";
