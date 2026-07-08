-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'suspended', 'cancelled');

-- AlterTable: tenants.status text -> enum (existing data is always 'active', safe cast)
ALTER TABLE "tenants" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "status" TYPE "TenantStatus" USING "status"::"TenantStatus";
ALTER TABLE "tenants" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable: tenants company-profile fields
ALTER TABLE "tenants" ADD COLUMN     "address" TEXT,
ADD COLUMN     "tax_number" TEXT,
ADD COLUMN     "logo_path" TEXT,
ADD COLUMN     "default_tax_template_id" TEXT;

-- AlterTable: customers walk-in flag
ALTER TABLE "customers" ADD COLUMN     "is_walk_in" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_limit" INTEGER,
    "invoice_limit" INTEGER,
    "branch_limit" INTEGER,
    "price_monthly" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscriptions_tenant_id_key" ON "tenant_subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_username_key" ON "platform_admins"("username");

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
