-- Drop old payment tables
DROP TABLE IF EXISTS "appointment_payment_lines";
DROP TABLE IF EXISTS "appointment_payments";

-- Add patient balance
ALTER TABLE "patients" ADD COLUMN "current_balance" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- PatientLedgerEntry
CREATE TABLE "patient_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "entry_type" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "balance_after" DECIMAL(14,4) NOT NULL,
    "description" TEXT,
    "created_by" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "patient_ledger_entries_patient_id_idx" ON "patient_ledger_entries"("patient_id");
ALTER TABLE "patient_ledger_entries" ADD CONSTRAINT "patient_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_ledger_entries" ADD CONSTRAINT "patient_ledger_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_ledger_entries" ADD CONSTRAINT "patient_ledger_entries_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AppointmentBill
CREATE TABLE "appointment_bills" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "consultation_fee" DECIMAL(14,4) NOT NULL,
    "medicine_total" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "total_due" DECIMAL(14,4) NOT NULL,
    "advance_applied" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "total_collected" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "change_given" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "patient_balance" DECIMAL(14,4) NOT NULL,
    "notes" TEXT,
    "finalized_by" TEXT,
    "finalized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_bills_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "appointment_bills_appointment_id_key" ON "appointment_bills"("appointment_id");
ALTER TABLE "appointment_bills" ADD CONSTRAINT "appointment_bills_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointment_bills" ADD CONSTRAINT "appointment_bills_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AppointmentBillLine
CREATE TABLE "appointment_bill_lines" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "line_type" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,4) NOT NULL,
    "line_total" DECIMAL(14,4) NOT NULL,
    CONSTRAINT "appointment_bill_lines_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "appointment_bill_lines" ADD CONSTRAINT "appointment_bill_lines_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "appointment_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointment_bill_lines" ADD CONSTRAINT "appointment_bill_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AppointmentBillPayment
CREATE TABLE "appointment_bill_payments" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "reference" TEXT,
    CONSTRAINT "appointment_bill_payments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "appointment_bill_payments" ADD CONSTRAINT "appointment_bill_payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "appointment_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
