ALTER TYPE "GoodsReceiptStatus" ADD VALUE 'voided';
ALTER TYPE "SupplierInvoiceStatus" ADD VALUE 'voided';
ALTER TYPE "SupplierLedgerEntryType" ADD VALUE 'void_reversal';

ALTER TABLE "purchase_orders" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "voided_at" TIMESTAMP(3);

ALTER TABLE "goods_receipts" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "voided_at" TIMESTAMP(3);

ALTER TABLE "supplier_invoices" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "supplier_invoices" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "supplier_invoices" ADD COLUMN "voided_at" TIMESTAMP(3);

ALTER TABLE "supplier_payments" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "supplier_payments" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "supplier_payments" ADD COLUMN "voided_at" TIMESTAMP(3);
