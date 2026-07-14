<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        // PostgreSQL needs custom ENUM types created up-front.
        // MySQL/MariaDB: column definitions use plain strings â€” no pre-creation needed.
        if ($driver === 'pgsql') {
            $enums = [
                "CREATE TYPE tenant_status AS ENUM ('active','suspended')",
                "CREATE TYPE tax_type AS ENUM ('vat','gst','sales_tax','custom')",
                "CREATE TYPE invoice_status AS ENUM ('held','completed','voided')",
                "CREATE TYPE invoice_type AS ENUM ('sale','return')",
                "CREATE TYPE payment_method AS ENUM ('cash','debit_card','credit_card','bank_transfer','mobile_wallet','credit_sale','store_credit','gift_card','patient_advance')",
                "CREATE TYPE stock_movement_type AS ENUM ('purchase_receipt','purchase_return','sale','sale_return','adjustment','transfer_out','transfer_in','opening_balance')",
                "CREATE TYPE loyalty_transaction_type AS ENUM ('earn','redeem','adjustment')",
                "CREATE TYPE coupon_discount_type AS ENUM ('percentage','fixed')",
                "CREATE TYPE gift_card_transaction_type AS ENUM ('issue','redeem','reload')",
                "CREATE TYPE customer_ledger_entry_type AS ENUM ('invoice','payment','return','opening_balance')",
                "CREATE TYPE supplier_ledger_entry_type AS ENUM ('purchase_invoice','payment','return','opening_balance','void_reversal')",
                "CREATE TYPE purchase_order_status AS ENUM ('draft','sent','partially_received','received','cancelled')",
                "CREATE TYPE goods_receipt_status AS ENUM ('draft','posted','voided')",
                "CREATE TYPE supplier_invoice_status AS ENUM ('unpaid','partially_paid','paid','voided')",
                "CREATE TYPE stock_adjustment_status AS ENUM ('draft','posted')",
                "CREATE TYPE stock_transfer_status AS ENUM ('draft','dispatched','received','cancelled')",
                "CREATE TYPE serial_number_status AS ENUM ('in_stock','sold','returned')",
                "CREATE TYPE subscription_status AS ENUM ('active','expired','suspended','cancelled')",
                "CREATE TYPE printer_type AS ENUM ('thermal_80','thermal_58','a4','pdf')",
                "CREATE TYPE appointment_type AS ENUM ('walk_in','advance')",
                "CREATE TYPE appointment_status AS ENUM ('booked','confirmed','completed','cancelled','no_show')",
                "CREATE TYPE day_of_week AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')",
            ];
            foreach ($enums as $sql) {
                DB::statement("DO \$\$ BEGIN {$sql}; EXCEPTION WHEN duplicate_object THEN null; END \$\$;");
            }
        }

        // UUIDs are generated in PHP by HasUuidPrimaryKey trait â€” no DB-level default needed.

        // ---------- Tenants ----------
        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('base_currency', 10)->default('USD');
            $table->string('status')->default('active');
            $table->text('address')->nullable();
            $table->string('tax_number')->nullable();
            $table->string('logo_path')->nullable();
            $table->uuid('default_tax_template_id')->nullable();
            $table->timestamps();
        });

        // ---------- Plans & Subscriptions ----------
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->integer('user_limit')->nullable();
            $table->integer('invoice_limit')->nullable();
            $table->integer('branch_limit')->nullable();
            $table->decimal('price_monthly', 10, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('tenant_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->uuid('plan_id');
            $table->timestamp('start_date');
            $table->timestamp('expiry_date');
            $table->string('status')->default('active');
            $table->integer('grace_period_days')->default(7);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign('plan_id')->references('id')->on('plans');
        });

        // ---------- Platform Admins ----------
        Schema::create('platform_admins', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('username')->unique();
            $table->string('email')->nullable();
            $table->string('full_name');
            $table->string('password_hash');
            $table->timestamp('created_at')->useCurrent();
        });

        // ---------- Module Entitlements ----------
        Schema::create('module_catalog', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('tenant_modules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('module_id');
            $table->boolean('enabled')->default(false);
            $table->timestamp('start_date')->nullable();
            $table->timestamp('expiry_date')->nullable();
            $table->integer('grace_period_days')->default(7);
            $table->json('limits')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'module_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign('module_id')->references('id')->on('module_catalog');
        });

        // ---------- Branches ----------
        Schema::create('branches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('code');
            $table->string('timezone')->default('UTC');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->foreign('tenant_id')->references('id')->on('tenants');
        });

        // ---------- Users ----------
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('full_name');
            $table->string('username');
            $table->string('email')->nullable();
            $table->string('pin_hash')->nullable();
            $table->string('password_hash')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->unique(['tenant_id', 'username']);
            $table->foreign('tenant_id')->references('id')->on('tenants');
        });

        // ---------- Roles & Permissions ----------
        Schema::create('permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->string('module');
            $table->string('description');
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->boolean('is_system_role')->default(false);

            $table->unique(['tenant_id', 'name']);
            $table->foreign('tenant_id')->references('id')->on('tenants');
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->uuid('role_id');
            $table->uuid('permission_id');

            $table->primary(['role_id', 'permission_id']);
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
            $table->foreign('permission_id')->references('id')->on('permissions')->onDelete('cascade');
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->uuid('role_id');

            $table->primary(['user_id', 'role_id']);
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
        });

        // ---------- Currencies ----------
        Schema::create('currencies', function (Blueprint $table) {
            $table->string('code', 10)->primary();
            $table->string('name');
            $table->string('symbol', 10);
            $table->integer('decimal_places')->default(2);
        });

        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('currency_code', 10);
            $table->decimal('rate_to_base', 18, 8);
            $table->timestamp('effective_at')->useCurrent();

            $table->index(['currency_code', 'effective_at']);
            $table->foreign('currency_code')->references('code')->on('currencies');
        });

        // ---------- Tax Templates ----------
        Schema::create('tax_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('tax_type')->default('custom');
            $table->decimal('rate_pct', 6, 3);
            $table->boolean('is_inclusive')->default(false);
            $table->boolean('is_active')->default(true);
        });

        // ---------- Categories ----------
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('parent_id')->nullable();
            $table->string('name');
            $table->integer('sort_order')->default(0);
        });

        // ---------- Products ----------
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('sku');
            $table->string('barcode')->nullable();
            $table->string('name');
            $table->text('description')->nullable();
            $table->uuid('category_id')->nullable();
            $table->decimal('cost_price', 14, 4)->default(0);
            $table->decimal('sale_price', 14, 4);
            $table->decimal('tax_rate_pct', 6, 3)->default(0);
            $table->uuid('tax_template_id')->nullable();
            $table->decimal('reorder_level', 14, 4)->default(0);
            $table->uuid('parent_product_id')->nullable();
            $table->json('variant_attributes')->nullable();
            $table->boolean('is_bundle')->default(false);
            $table->boolean('track_batches')->default(false);
            $table->boolean('track_serials')->default(false);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'sku']);
            $table->index(['tenant_id', 'barcode']);
            $table->index('parent_product_id');
            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
            $table->foreign('tax_template_id')->references('id')->on('tax_templates')->nullOnDelete();
        });

        Schema::create('bundle_components', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('bundle_product_id');
            $table->uuid('component_product_id');
            $table->decimal('quantity', 14, 4);

            $table->unique(['bundle_product_id', 'component_product_id']);
            $table->foreign('bundle_product_id')->references('id')->on('products');
            $table->foreign('component_product_id')->references('id')->on('products');
        });

        // ---------- Warehouses & Stock ----------
        Schema::create('warehouses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('branch_id');
            $table->string('name');
            $table->boolean('is_default')->default(true);

            $table->foreign('branch_id')->references('id')->on('branches');
        });

        Schema::create('stock_levels', function (Blueprint $table) {
            $table->uuid('warehouse_id');
            $table->uuid('product_id');
            $table->decimal('quantity_on_hand', 14, 4)->default(0);
            $table->decimal('quantity_reserved', 14, 4)->default(0);

            $table->primary(['warehouse_id', 'product_id']);
            $table->foreign('warehouse_id')->references('id')->on('warehouses');
            $table->foreign('product_id')->references('id')->on('products');
        });

        Schema::create('stock_ledger', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('warehouse_id');
            $table->uuid('product_id');
            $table->string('movement_type');
            $table->decimal('quantity_delta', 14, 4);
            $table->decimal('unit_cost_at_movement', 14, 4)->default(0);
            $table->string('reference_table')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->timestamp('occurred_at')->useCurrent();

            $table->index(['product_id', 'warehouse_id', 'occurred_at']);
            $table->foreign('warehouse_id')->references('id')->on('warehouses');
            $table->foreign('product_id')->references('id')->on('products');
        });

        // ---------- Batches & Serials ----------
        Schema::create('batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->uuid('warehouse_id');
            $table->string('batch_no');
            $table->date('expiry_date')->nullable();
            $table->decimal('quantity_on_hand', 14, 4)->default(0);
            $table->decimal('cost_price', 14, 4)->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['product_id', 'warehouse_id', 'batch_no']);
            $table->index(['product_id', 'warehouse_id', 'expiry_date']);
            $table->foreign('product_id')->references('id')->on('products');
            $table->foreign('warehouse_id')->references('id')->on('warehouses');
        });

        Schema::create('serial_numbers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->uuid('warehouse_id');
            $table->string('serial_no');
            $table->string('status')->default('in_stock');
            $table->uuid('invoice_line_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['product_id', 'serial_no']);
            $table->foreign('product_id')->references('id')->on('products');
            $table->foreign('warehouse_id')->references('id')->on('warehouses');
        });

        // ---------- Customers ----------
        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('tax_number')->nullable();
            $table->decimal('credit_limit', 14, 4)->default(0);
            $table->decimal('current_balance', 14, 4)->default(0);
            $table->decimal('loyalty_points', 14, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_walk_in')->default(false);
            $table->timestamps();
        });

        Schema::create('customer_ledger_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id');
            $table->string('entry_type');
            $table->decimal('amount', 14, 4);
            $table->decimal('balance_after', 14, 4);
            $table->string('reference_table')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('occurred_at')->useCurrent();

            $table->index(['customer_id', 'occurred_at']);
            $table->foreign('customer_id')->references('id')->on('customers');
        });

        Schema::create('loyalty_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id');
            $table->string('type');
            $table->decimal('points', 14, 4);
            $table->decimal('balance_after', 14, 4);
            $table->string('reference_table')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->timestamp('occurred_at')->useCurrent();

            $table->index(['customer_id', 'occurred_at']);
            $table->foreign('customer_id')->references('id')->on('customers');
        });

        // ---------- Coupons & Gift Cards ----------
        Schema::create('coupons', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('code');
            $table->string('discount_type');
            $table->decimal('discount_value', 14, 4);
            $table->timestamp('expiry_date')->nullable();
            $table->integer('usage_limit')->nullable();
            $table->integer('usage_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('gift_cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('code');
            $table->decimal('initial_balance', 14, 4);
            $table->decimal('current_balance', 14, 4);
            $table->timestamp('expiry_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('issued_at')->useCurrent();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('gift_card_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gift_card_id');
            $table->string('type');
            $table->decimal('amount', 14, 4);
            $table->decimal('balance_after', 14, 4);
            $table->string('reference_table')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->timestamp('occurred_at')->useCurrent();

            $table->foreign('gift_card_id')->references('id')->on('gift_cards');
        });

        // ---------- Suppliers ----------
        Schema::create('suppliers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('tax_number')->nullable();
            $table->decimal('current_balance', 14, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('supplier_ledger_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('supplier_id');
            $table->string('entry_type');
            $table->decimal('amount', 14, 4);
            $table->decimal('balance_after', 14, 4);
            $table->string('reference_table')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('occurred_at')->useCurrent();

            $table->index(['supplier_id', 'occurred_at']);
            $table->foreign('supplier_id')->references('id')->on('suppliers');
        });

        // ---------- Invoices (POS Sales) ----------
        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('branch_id');
            $table->string('invoice_no');
            $table->string('invoice_type')->default('sale');
            $table->string('status')->default('completed');
            $table->uuid('customer_id')->nullable();
            $table->uuid('patient_id')->nullable();
            $table->decimal('subtotal', 14, 4)->default(0);
            $table->decimal('discount_total', 14, 4)->default(0);
            $table->decimal('tax_total', 14, 4)->default(0);
            $table->decimal('grand_total', 14, 4)->default(0);
            $table->uuid('cashier_id')->nullable();
            $table->string('held_label')->nullable();
            $table->uuid('original_invoice_id')->nullable();
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('currency_code', 10)->nullable();
            $table->decimal('exchange_rate_to_base', 18, 8)->nullable();
            $table->decimal('loyalty_points_earned', 14, 4)->default(0);
            $table->decimal('loyalty_points_redeemed', 14, 4)->default(0);
            $table->string('coupon_code')->nullable();
            $table->decimal('coupon_discount_amount', 14, 4)->default(0);
            $table->timestamps();

            $table->unique(['branch_id', 'invoice_no']);
            $table->index(['branch_id', 'status', 'created_at']);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
        });

        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_id');
            $table->uuid('product_id');
            $table->decimal('quantity', 14, 4);
            $table->decimal('unit_price', 14, 4);
            $table->decimal('discount_value', 14, 4)->default(0);
            $table->decimal('tax_amount', 14, 4)->default(0);
            $table->decimal('line_total', 14, 4);
            $table->uuid('original_invoice_line_id')->nullable();

            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
        });

        Schema::create('invoice_line_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_line_id');
            $table->uuid('batch_id');
            $table->decimal('quantity', 14, 4);

            $table->foreign('invoice_line_id')->references('id')->on('invoice_lines')->onDelete('cascade');
            $table->foreign('batch_id')->references('id')->on('batches');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_id');
            $table->string('method');
            $table->decimal('amount', 14, 4);
            $table->decimal('received_amount', 14, 4)->nullable();
            $table->decimal('change_amount', 14, 4)->nullable();
            $table->string('reference')->nullable();

            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('cascade');
        });

        Schema::create('cash_drawer_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('branch_id');
            $table->uuid('opened_by');
            $table->uuid('closed_by')->nullable();
            $table->decimal('opening_float', 14, 4)->default(0);
            $table->decimal('expected_close', 14, 4)->nullable();
            $table->decimal('closing_count', 14, 4)->nullable();
            $table->decimal('variance', 14, 4)->nullable();
            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('closed_at')->nullable();

            $table->index(['branch_id', 'opened_at']);
            $table->foreign('branch_id')->references('id')->on('branches');
        });

        // ---------- Purchasing ----------
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('supplier_id');
            $table->uuid('warehouse_id');
            $table->string('order_no');
            $table->string('status')->default('draft');
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'order_no']);
            $table->foreign('supplier_id')->references('id')->on('suppliers');
            $table->foreign('warehouse_id')->references('id')->on('warehouses');
        });

        Schema::create('purchase_order_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('purchase_order_id');
            $table->uuid('product_id');
            $table->decimal('quantity_ordered', 14, 4);
            $table->decimal('quantity_received', 14, 4)->default(0);
            $table->decimal('unit_cost', 14, 4);

            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
        });

        Schema::create('goods_receipts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('purchase_order_id')->nullable();
            $table->uuid('warehouse_id');
            $table->string('receipt_no');
            $table->string('status')->default('draft');
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->timestamp('received_at')->useCurrent();

            $table->unique(['warehouse_id', 'receipt_no']);
            $table->foreign('warehouse_id')->references('id')->on('warehouses');
        });

        Schema::create('goods_receipt_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('goods_receipt_id');
            $table->uuid('product_id');
            $table->decimal('quantity_received', 14, 4);
            $table->decimal('unit_cost', 14, 4);
            $table->string('batch_no')->nullable();
            $table->date('expiry_date')->nullable();
            $table->json('serial_numbers')->nullable();

            $table->foreign('goods_receipt_id')->references('id')->on('goods_receipts')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
        });

        Schema::create('supplier_invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('supplier_id');
            $table->uuid('goods_receipt_id')->nullable();
            $table->string('invoice_no');
            $table->decimal('amount', 14, 4);
            $table->decimal('amount_paid', 14, 4)->default(0);
            $table->timestamp('due_date')->nullable();
            $table->string('status')->default('unpaid');
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('supplier_id')->references('id')->on('suppliers');
        });

        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('supplier_id');
            $table->decimal('amount', 14, 4);
            $table->string('method')->default('cash');
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->timestamp('paid_at')->useCurrent();

            $table->foreign('supplier_id')->references('id')->on('suppliers');
        });

        Schema::create('supplier_payment_allocations', function (Blueprint $table) {
            $table->uuid('supplier_payment_id');
            $table->uuid('supplier_invoice_id');
            $table->decimal('amount_allocated', 14, 4);

            $table->primary(['supplier_payment_id', 'supplier_invoice_id']);
            $table->foreign('supplier_payment_id')->references('id')->on('supplier_payments');
            $table->foreign('supplier_invoice_id')->references('id')->on('supplier_invoices');
        });

        // ---------- Inventory Ops ----------
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('warehouse_id');
            $table->string('reason_code');
            $table->text('note')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('warehouse_id')->references('id')->on('warehouses');
        });

        Schema::create('stock_adjustment_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('stock_adjustment_id');
            $table->uuid('product_id');
            $table->decimal('counted_quantity', 14, 4);
            $table->decimal('system_quantity', 14, 4);

            $table->foreign('stock_adjustment_id')->references('id')->on('stock_adjustments')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
        });

        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('from_warehouse_id');
            $table->uuid('to_warehouse_id');
            $table->string('status')->default('draft');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('from_warehouse_id')->references('id')->on('warehouses');
            $table->foreign('to_warehouse_id')->references('id')->on('warehouses');
        });

        Schema::create('stock_transfer_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('stock_transfer_id');
            $table->uuid('product_id');
            $table->decimal('quantity', 14, 4);

            $table->foreign('stock_transfer_id')->references('id')->on('stock_transfers')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
        });

        // ---------- Accounting Lite ----------
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('branch_id');
            $table->uuid('category_id');
            $table->decimal('amount', 14, 4);
            $table->text('note')->nullable();
            $table->string('paid_via')->default('cash');
            $table->timestamp('occurred_at')->useCurrent();
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();

            $table->foreign('branch_id')->references('id')->on('branches');
            $table->foreign('category_id')->references('id')->on('expense_categories');
        });

        Schema::create('income_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('branch_id');
            $table->string('category');
            $table->decimal('amount', 14, 4);
            $table->text('note')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();

            $table->foreign('branch_id')->references('id')->on('branches');
        });

        Schema::create('daily_closings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('branch_id');
            $table->date('business_date');
            $table->decimal('expected_cash', 14, 4);
            $table->decimal('counted_cash', 14, 4);
            $table->decimal('variance', 14, 4);
            $table->uuid('closed_by');
            $table->timestamp('closed_at')->useCurrent();
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();

            $table->unique(['branch_id', 'business_date']);
            $table->foreign('branch_id')->references('id')->on('branches');
        });

        // ---------- Printing ----------
        Schema::create('printers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('branch_id');
            $table->string('name');
            $table->string('type');
            $table->string('system_printer_name');
            $table->boolean('is_default_receipt')->default(false);
            $table->boolean('is_default_invoice')->default(false);
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id']);
            $table->foreign('branch_id')->references('id')->on('branches');
        });

        Schema::create('receipt_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->text('header_text')->nullable();
            $table->text('footer_text')->nullable();
            $table->integer('paper_width_mm')->default(80);
            $table->timestamps();
        });

        // ---------- Hospital Module ----------
        Schema::create('doctors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('linked_user_id')->unique()->nullable();
            $table->string('name');
            $table->string('specialization')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('room_number')->nullable();
            $table->decimal('consultation_fee', 14, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign('linked_user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('doctor_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('doctor_id');
            $table->string('day_of_week');
            $table->string('start_time', 5);
            $table->string('end_time', 5);

            $table->unique(['doctor_id', 'day_of_week', 'start_time']);
            $table->foreign('doctor_id')->references('id')->on('doctors')->onDelete('cascade');
        });

        Schema::create('patients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('gender')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->text('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->decimal('current_balance', 14, 4)->default(0);
            $table->timestamps();

            $table->index('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants');
        });

        Schema::create('appointments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('doctor_id');
            $table->uuid('patient_id');
            $table->string('appointment_type');
            $table->string('status')->default('booked');
            $table->date('appointment_date');
            $table->integer('token_number');
            $table->timestamp('booked_at')->useCurrent();
            $table->timestamp('arrived_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('cancel_reason')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->unique(['doctor_id', 'appointment_date', 'token_number']);
            $table->index(['tenant_id', 'appointment_date']);
            $table->index(['doctor_id', 'appointment_date', 'status']);
            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign('doctor_id')->references('id')->on('doctors');
            $table->foreign('patient_id')->references('id')->on('patients');
        });

        // Add patient_id FK to invoices now that patients table exists
        Schema::table('invoices', function (Blueprint $table) {
            $table->foreign('patient_id')->references('id')->on('patients')->nullOnDelete();
        });

        Schema::create('patient_ledger_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('patient_id');
            $table->uuid('appointment_id')->nullable();
            $table->string('entry_type');
            $table->decimal('amount', 14, 4);
            $table->decimal('balance_after', 14, 4);
            $table->text('description')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamp('occurred_at')->useCurrent();

            $table->index('patient_id');
            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign('patient_id')->references('id')->on('patients');
            $table->foreign('appointment_id')->references('id')->on('appointments')->nullOnDelete();
        });

        Schema::create('appointment_bills', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('appointment_id')->unique();
            $table->boolean('is_draft')->default(false);
            $table->decimal('consultation_fee', 14, 4);
            $table->decimal('medicine_total', 14, 4)->default(0);
            $table->decimal('total_due', 14, 4);
            $table->decimal('advance_applied', 14, 4)->default(0);
            $table->decimal('total_collected', 14, 4)->default(0);
            $table->decimal('advance_credited', 14, 4)->default(0);
            $table->decimal('patient_balance', 14, 4)->default(0);
            $table->text('notes')->nullable();
            $table->uuid('finalized_by')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign('appointment_id')->references('id')->on('appointments');
        });

        Schema::create('appointment_bill_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('bill_id');
            $table->string('line_type');
            $table->uuid('product_id')->nullable();
            $table->text('description');
            $table->decimal('quantity', 14, 4)->default(1);
            $table->decimal('unit_price', 14, 4);
            $table->decimal('line_total', 14, 4);

            $table->foreign('bill_id')->references('id')->on('appointment_bills')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        Schema::create('appointment_bill_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('bill_id');
            $table->string('method');
            $table->decimal('amount', 14, 4);
            $table->string('reference')->nullable();

            $table->foreign('bill_id')->references('id')->on('appointment_bills')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        // Drop in reverse order of creation
        Schema::dropIfExists('appointment_bill_payments');
        Schema::dropIfExists('appointment_bill_lines');
        Schema::dropIfExists('appointment_bills');
        Schema::dropIfExists('patient_ledger_entries');
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('doctor_schedules');
        Schema::dropIfExists('doctors');
        Schema::dropIfExists('patients');
        Schema::dropIfExists('receipt_settings');
        Schema::dropIfExists('printers');
        Schema::dropIfExists('daily_closings');
        Schema::dropIfExists('income_entries');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('expense_categories');
        Schema::dropIfExists('stock_transfer_lines');
        Schema::dropIfExists('stock_transfers');
        Schema::dropIfExists('stock_adjustment_lines');
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('supplier_payment_allocations');
        Schema::dropIfExists('supplier_payments');
        Schema::dropIfExists('supplier_invoices');
        Schema::dropIfExists('goods_receipt_lines');
        Schema::dropIfExists('goods_receipts');
        Schema::dropIfExists('purchase_order_lines');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('supplier_ledger_entries');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('cash_drawer_sessions');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_line_batches');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('gift_card_transactions');
        Schema::dropIfExists('gift_cards');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('customer_ledger_entries');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('serial_numbers');
        Schema::dropIfExists('batches');
        Schema::dropIfExists('stock_ledger');
        Schema::dropIfExists('stock_levels');
        Schema::dropIfExists('warehouses');
        Schema::dropIfExists('bundle_components');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('tax_templates');
        Schema::dropIfExists('exchange_rates');
        Schema::dropIfExists('currencies');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('tenant_modules');
        Schema::dropIfExists('module_catalog');
        Schema::dropIfExists('platform_admins');
        Schema::dropIfExists('tenant_subscriptions');
        Schema::dropIfExists('plans');
        Schema::dropIfExists('tenants');

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("DROP TYPE IF EXISTS appointment_status");
            DB::statement("DROP TYPE IF EXISTS appointment_type");
            DB::statement("DROP TYPE IF EXISTS day_of_week");
            DB::statement("DROP TYPE IF EXISTS printer_type");
            DB::statement("DROP TYPE IF EXISTS subscription_status");
            DB::statement("DROP TYPE IF EXISTS serial_number_status");
            DB::statement("DROP TYPE IF EXISTS stock_transfer_status");
            DB::statement("DROP TYPE IF EXISTS stock_adjustment_status");
            DB::statement("DROP TYPE IF EXISTS supplier_invoice_status");
            DB::statement("DROP TYPE IF EXISTS goods_receipt_status");
            DB::statement("DROP TYPE IF EXISTS purchase_order_status");
            DB::statement("DROP TYPE IF EXISTS supplier_ledger_entry_type");
            DB::statement("DROP TYPE IF EXISTS customer_ledger_entry_type");
            DB::statement("DROP TYPE IF EXISTS gift_card_transaction_type");
            DB::statement("DROP TYPE IF EXISTS coupon_discount_type");
            DB::statement("DROP TYPE IF EXISTS loyalty_transaction_type");
            DB::statement("DROP TYPE IF EXISTS stock_movement_type");
            DB::statement("DROP TYPE IF EXISTS payment_method");
            DB::statement("DROP TYPE IF EXISTS invoice_type");
            DB::statement("DROP TYPE IF EXISTS invoice_status");
            DB::statement("DROP TYPE IF EXISTS tax_type");
            DB::statement("DROP TYPE IF EXISTS tenant_status");
        }
    }
};

