-- CreateEnum
CREATE TYPE "PrinterType" AS ENUM ('thermal_80', 'thermal_58', 'a4', 'pdf');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "printers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PrinterType" NOT NULL,
    "system_printer_name" TEXT NOT NULL,
    "is_default_receipt" BOOLEAN NOT NULL DEFAULT false,
    "is_default_invoice" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "header_text" TEXT,
    "footer_text" TEXT,
    "paper_width_mm" INTEGER NOT NULL DEFAULT 80,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "printers_tenant_id_branch_id_idx" ON "printers"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_settings_tenant_id_key" ON "receipt_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
