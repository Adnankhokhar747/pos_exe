ALTER TABLE "expenses" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "expenses" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "expenses" ADD COLUMN "voided_at" TIMESTAMP(3);

ALTER TABLE "income_entries" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "income_entries" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "income_entries" ADD COLUMN "voided_at" TIMESTAMP(3);

ALTER TABLE "daily_closings" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "daily_closings" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "daily_closings" ADD COLUMN "voided_at" TIMESTAMP(3);
