-- CreateTable
CREATE TABLE "appointment_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "total_due" DECIMAL(14,4) NOT NULL,
    "total_paid" DECIMAL(14,4) NOT NULL,
    "change_given" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "collected_by" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_payment_lines" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "reference" TEXT,

    CONSTRAINT "appointment_payment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_payments_appointment_id_key" ON "appointment_payments"("appointment_id");

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payment_lines" ADD CONSTRAINT "appointment_payment_lines_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "appointment_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
