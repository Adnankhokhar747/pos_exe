<?php

namespace App\Services;

use App\Models\TenantBackupSnapshot;
use App\Models\TenantCloudBackup;
use Illuminate\Support\Facades\DB;

class BackupService
{
    // ─── Settings helpers ─────────────────────────────────────────────────────

    public function getSettings(string $tenantId): TenantCloudBackup
    {
        return TenantCloudBackup::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['enabled' => false, 'auto_backup' => true, 'max_snapshots' => 10]
        );
    }

    public function updateSettings(string $tenantId, array $data): TenantCloudBackup
    {
        $settings = $this->getSettings($tenantId);
        $settings->update(array_filter($data, fn($v) => $v !== null));
        return $settings->fresh();
    }

    // ─── Export ──────────────────────────────────────────────────────────────

    public function export(string $tenantId): array
    {
        $branchIds          = DB::table('branches')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $warehouseIds       = DB::table('warehouses')->whereIn('branch_id', $branchIds)->pluck('id')->toArray();
        $productIds         = DB::table('products')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $customerIds        = DB::table('customers')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $supplierIds        = DB::table('suppliers')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $invoiceIds         = DB::table('invoices')->whereIn('branch_id', $branchIds)->pluck('id')->toArray();
        $purchaseOrderIds   = DB::table('purchase_orders')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $giftCardIds        = DB::table('gift_cards')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $doctorIds          = DB::table('doctors')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $patientIds         = DB::table('patients')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $billIds            = DB::table('appointment_bills')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $stockAdjIds        = $this->safe($warehouseIds) ? DB::table('stock_adjustments')->whereIn('warehouse_id', $warehouseIds)->pluck('id')->toArray() : [];
        $stockTransIds      = $this->safe($warehouseIds) ? DB::table('stock_transfers')->whereIn('from_warehouse_id', $warehouseIds)->pluck('id')->toArray() : [];
        $goodsReceiptIds    = $this->safe($warehouseIds) ? DB::table('goods_receipts')->whereIn('warehouse_id', $warehouseIds)->pluck('id')->toArray() : [];
        $supplierInvoiceIds = $this->safe($supplierIds) ? DB::table('supplier_invoices')->whereIn('supplier_id', $supplierIds)->pluck('id')->toArray() : [];
        $supplierPaymentIds = $this->safe($supplierIds) ? DB::table('supplier_payments')->whereIn('supplier_id', $supplierIds)->pluck('id')->toArray() : [];
        $userIds            = DB::table('users')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $roleIds            = DB::table('roles')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $invoiceLineIds     = $this->safe($invoiceIds) ? DB::table('invoice_lines')->whereIn('invoice_id', $invoiceIds)->pluck('id')->toArray() : [];

        $rows = fn($table, $query) => array_map(fn($r) => (array) $r, $query->get()->toArray());

        $tables = [
            'branches'                      => $rows('branches',                      DB::table('branches')->where('tenant_id', $tenantId)),
            'users'                         => $rows('users',                         DB::table('users')->where('tenant_id', $tenantId)),
            'roles'                         => $rows('roles',                         DB::table('roles')->where('tenant_id', $tenantId)),
            'role_permissions'              => $this->safe($roleIds)            ? $rows('role_permissions',              DB::table('role_permissions')->whereIn('role_id', $roleIds))                               : [],
            'user_roles'                    => $this->safe($userIds)            ? $rows('user_roles',                    DB::table('user_roles')->whereIn('user_id', $userIds))                                     : [],
            'tax_templates'                 => $rows('tax_templates',                  DB::table('tax_templates')->where('tenant_id', $tenantId)),
            'categories'                    => $rows('categories',                     DB::table('categories')->where('tenant_id', $tenantId)),
            'products'                      => $rows('products',                       DB::table('products')->where('tenant_id', $tenantId)),
            'bundle_components'             => $this->safe($productIds)         ? $rows('bundle_components',             DB::table('bundle_components')->whereIn('bundle_product_id', $productIds))                   : [],
            'warehouses'                    => $this->safe($branchIds)          ? $rows('warehouses',                    DB::table('warehouses')->whereIn('branch_id', $branchIds))                                  : [],
            'stock_levels'                  => $this->safe($warehouseIds)       ? $rows('stock_levels',                  DB::table('stock_levels')->whereIn('warehouse_id', $warehouseIds))                          : [],
            'stock_ledger'                  => $this->safe($warehouseIds)       ? $rows('stock_ledger',                  DB::table('stock_ledger')->whereIn('warehouse_id', $warehouseIds))                          : [],
            'batches'                       => $this->safe($productIds)         ? $rows('batches',                       DB::table('batches')->whereIn('product_id', $productIds))                                   : [],
            'serial_numbers'                => $this->safe($productIds)         ? $rows('serial_numbers',                DB::table('serial_numbers')->whereIn('product_id', $productIds))                            : [],
            'customers'                     => $rows('customers',                      DB::table('customers')->where('tenant_id', $tenantId)),
            'customer_ledger_entries'       => $this->safe($customerIds)        ? $rows('customer_ledger_entries',       DB::table('customer_ledger_entries')->whereIn('customer_id', $customerIds))                  : [],
            'loyalty_transactions'          => $this->safe($customerIds)        ? $rows('loyalty_transactions',          DB::table('loyalty_transactions')->whereIn('customer_id', $customerIds))                    : [],
            'coupons'                       => $rows('coupons',                        DB::table('coupons')->where('tenant_id', $tenantId)),
            'gift_cards'                    => $rows('gift_cards',                     DB::table('gift_cards')->where('tenant_id', $tenantId)),
            'gift_card_transactions'        => $this->safe($giftCardIds)        ? $rows('gift_card_transactions',        DB::table('gift_card_transactions')->whereIn('gift_card_id', $giftCardIds))                  : [],
            'suppliers'                     => $rows('suppliers',                      DB::table('suppliers')->where('tenant_id', $tenantId)),
            'supplier_ledger_entries'       => $this->safe($supplierIds)        ? $rows('supplier_ledger_entries',       DB::table('supplier_ledger_entries')->whereIn('supplier_id', $supplierIds))                  : [],
            'invoices'                      => $this->safe($branchIds)          ? $rows('invoices',                      DB::table('invoices')->whereIn('branch_id', $branchIds))                                    : [],
            'invoice_lines'                 => $this->safe($invoiceIds)         ? $rows('invoice_lines',                 DB::table('invoice_lines')->whereIn('invoice_id', $invoiceIds))                             : [],
            'invoice_line_batches'          => $this->safe($invoiceLineIds)     ? $rows('invoice_line_batches',          DB::table('invoice_line_batches')->whereIn('invoice_line_id', $invoiceLineIds))              : [],
            'payments'                      => $this->safe($invoiceIds)         ? $rows('payments',                      DB::table('payments')->whereIn('invoice_id', $invoiceIds))                                  : [],
            'cash_drawer_sessions'          => $this->safe($branchIds)          ? $rows('cash_drawer_sessions',          DB::table('cash_drawer_sessions')->whereIn('branch_id', $branchIds))                        : [],
            'purchase_orders'               => $rows('purchase_orders',                DB::table('purchase_orders')->where('tenant_id', $tenantId)),
            'purchase_order_lines'          => $this->safe($purchaseOrderIds)   ? $rows('purchase_order_lines',          DB::table('purchase_order_lines')->whereIn('purchase_order_id', $purchaseOrderIds))         : [],
            'goods_receipts'                => $this->safe($warehouseIds)       ? $rows('goods_receipts',                DB::table('goods_receipts')->whereIn('warehouse_id', $warehouseIds))                        : [],
            'goods_receipt_lines'           => $this->safe($goodsReceiptIds)    ? $rows('goods_receipt_lines',           DB::table('goods_receipt_lines')->whereIn('goods_receipt_id', $goodsReceiptIds))            : [],
            'supplier_invoices'             => $this->safe($supplierIds)        ? $rows('supplier_invoices',             DB::table('supplier_invoices')->whereIn('supplier_id', $supplierIds))                       : [],
            'supplier_payments'             => $this->safe($supplierIds)        ? $rows('supplier_payments',             DB::table('supplier_payments')->whereIn('supplier_id', $supplierIds))                       : [],
            'supplier_payment_allocations'  => $this->safe($supplierPaymentIds) ? $rows('supplier_payment_allocations',  DB::table('supplier_payment_allocations')->whereIn('supplier_payment_id', $supplierPaymentIds)) : [],
            'stock_adjustments'             => $this->safe($warehouseIds)       ? $rows('stock_adjustments',             DB::table('stock_adjustments')->whereIn('warehouse_id', $warehouseIds))                     : [],
            'stock_adjustment_lines'        => $this->safe($stockAdjIds)        ? $rows('stock_adjustment_lines',        DB::table('stock_adjustment_lines')->whereIn('stock_adjustment_id', $stockAdjIds))          : [],
            'stock_transfers'               => $this->safe($warehouseIds)       ? $rows('stock_transfers',               DB::table('stock_transfers')->whereIn('from_warehouse_id', $warehouseIds))                  : [],
            'stock_transfer_lines'          => $this->safe($stockTransIds)      ? $rows('stock_transfer_lines',          DB::table('stock_transfer_lines')->whereIn('stock_transfer_id', $stockTransIds))            : [],
            'expense_categories'            => $rows('expense_categories',             DB::table('expense_categories')->where('tenant_id', $tenantId)),
            'expenses'                      => $this->safe($branchIds)          ? $rows('expenses',                      DB::table('expenses')->whereIn('branch_id', $branchIds))                                    : [],
            'income_entries'                => $this->safe($branchIds)          ? $rows('income_entries',                DB::table('income_entries')->whereIn('branch_id', $branchIds))                              : [],
            'daily_closings'                => $this->safe($branchIds)          ? $rows('daily_closings',                DB::table('daily_closings')->whereIn('branch_id', $branchIds))                              : [],
            'printers'                      => $rows('printers',                       DB::table('printers')->where('tenant_id', $tenantId)),
            'receipt_settings'              => $rows('receipt_settings',               DB::table('receipt_settings')->where('tenant_id', $tenantId)),
            'doctors'                       => $rows('doctors',                        DB::table('doctors')->where('tenant_id', $tenantId)),
            'doctor_schedules'              => $this->safe($doctorIds)          ? $rows('doctor_schedules',              DB::table('doctor_schedules')->whereIn('doctor_id', $doctorIds))                            : [],
            'patients'                      => $rows('patients',                       DB::table('patients')->where('tenant_id', $tenantId)),
            'appointments'                  => $rows('appointments',                   DB::table('appointments')->where('tenant_id', $tenantId)),
            'patient_ledger_entries'        => $rows('patient_ledger_entries',         DB::table('patient_ledger_entries')->where('tenant_id', $tenantId)),
            'appointment_bills'             => $rows('appointment_bills',              DB::table('appointment_bills')->where('tenant_id', $tenantId)),
            'appointment_bill_lines'        => $this->safe($billIds)            ? $rows('appointment_bill_lines',        DB::table('appointment_bill_lines')->whereIn('bill_id', $billIds))                          : [],
            'appointment_bill_payments'     => $this->safe($billIds)            ? $rows('appointment_bill_payments',    DB::table('appointment_bill_payments')->whereIn('bill_id', $billIds))                        : [],
        ];

        return [
            'version'    => 2,
            'exportedAt' => now()->toISOString(),
            'tenantId'   => $tenantId,
            'tables'     => $tables,
        ];
    }

    // ─── Create snapshot ─────────────────────────────────────────────────────

    public function createSnapshot(string $tenantId, ?string $label = null): TenantBackupSnapshot
    {
        $data = $this->export($tenantId);
        $json = json_encode($data);

        $nextVersion = (TenantBackupSnapshot::where('tenant_id', $tenantId)->max('version') ?? 0) + 1;

        $snapshot = TenantBackupSnapshot::create([
            'tenant_id'     => $tenantId,
            'version'       => $nextVersion,
            'label'         => $label ?? 'Backup #' . $nextVersion,
            'snapshot_data' => $data,
            'size_bytes'    => strlen($json),
        ]);

        // Update last backed up timestamp
        TenantCloudBackup::where('tenant_id', $tenantId)->update(['last_backed_up_at' => now()]);

        // Prune old snapshots
        $settings = $this->getSettings($tenantId);
        $this->pruneOldSnapshots($tenantId, $settings->max_snapshots);

        return $snapshot;
    }

    // ─── Restore ─────────────────────────────────────────────────────────────

    public function restore(string $currentTenantId, array $snapshot): void
    {
        $sourceTenantId = $snapshot['tenantId'] ?? $currentTenantId;

        DB::transaction(function () use ($currentTenantId, $sourceTenantId, $snapshot) {
            $this->deleteAll($currentTenantId);
            $this->insertAll($currentTenantId, $sourceTenantId, $snapshot['tables']);
        });
    }

    // ─── Prune ───────────────────────────────────────────────────────────────

    public function pruneOldSnapshots(string $tenantId, int $maxSnapshots): void
    {
        $toDelete = TenantBackupSnapshot::where('tenant_id', $tenantId)
            ->orderByDesc('version')
            ->skip($maxSnapshots)
            ->pluck('id');

        if ($toDelete->isNotEmpty()) {
            TenantBackupSnapshot::whereIn('id', $toDelete)->delete();
        }
    }

    // ─── Check if tenant has operational data ────────────────────────────────

    public function hasOperationalData(string $tenantId): bool
    {
        return DB::table('branches')->where('tenant_id', $tenantId)->exists()
            || DB::table('invoices')
                ->whereIn('branch_id', DB::table('branches')->where('tenant_id', $tenantId)->select('id'))
                ->exists();
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private function safe(array $ids): bool
    {
        return count($ids) > 0;
    }

    private function deleteAll(string $tenantId): void
    {
        $branchIds = DB::table('branches')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $ph        = $this->placeholder($branchIds);

        $warehouseIds = $this->safe($branchIds)
            ? DB::table('warehouses')->whereIn('branch_id', $branchIds)->pluck('id')->toArray()
            : [];

        $productIds = DB::table('products')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $customerIds = DB::table('customers')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $supplierIds = DB::table('suppliers')->where('tenant_id', $tenantId)->pluck('id')->toArray();

        $invoiceIds = $this->safe($branchIds)
            ? DB::table('invoices')->whereIn('branch_id', $branchIds)->pluck('id')->toArray()
            : [];

        $purchaseOrderIds = DB::table('purchase_orders')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $giftCardIds = DB::table('gift_cards')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $doctorIds = DB::table('doctors')->where('tenant_id', $tenantId)->pluck('id')->toArray();

        $billIds = DB::table('appointment_bills')->where('tenant_id', $tenantId)->pluck('id')->toArray();

        $stockAdjIds = $this->safe($warehouseIds)
            ? DB::table('stock_adjustments')->whereIn('warehouse_id', $warehouseIds)->pluck('id')->toArray()
            : [];

        $stockTransIds = $this->safe($warehouseIds)
            ? DB::table('stock_transfers')->whereIn('from_warehouse_id', $warehouseIds)->pluck('id')->toArray()
            : [];

        $goodsReceiptIds = $this->safe($warehouseIds)
            ? DB::table('goods_receipts')->whereIn('warehouse_id', $warehouseIds)->pluck('id')->toArray()
            : [];

        $supplierInvoiceIds = $this->safe($supplierIds)
            ? DB::table('supplier_invoices')->whereIn('supplier_id', $supplierIds)->pluck('id')->toArray()
            : [];

        $supplierPaymentIds = $this->safe($supplierIds)
            ? DB::table('supplier_payments')->whereIn('supplier_id', $supplierIds)->pluck('id')->toArray()
            : [];

        $userIds = DB::table('users')->where('tenant_id', $tenantId)->pluck('id')->toArray();
        $roleIds = DB::table('roles')->where('tenant_id', $tenantId)->pluck('id')->toArray();

        $invoiceLineIds = $this->safe($invoiceIds)
            ? DB::table('invoice_lines')->whereIn('invoice_id', $invoiceIds)->pluck('id')->toArray()
            : [];

        // Delete deepest children first to respect FK constraints
        if ($this->safe($billIds)) {
            DB::table('appointment_bill_payments')->whereIn('bill_id', $billIds)->delete();
            DB::table('appointment_bill_lines')->whereIn('bill_id', $billIds)->delete();
        }
        DB::table('appointment_bills')->where('tenant_id', $tenantId)->delete();
        DB::table('patient_ledger_entries')->where('tenant_id', $tenantId)->delete();
        DB::table('appointments')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($doctorIds)) {
            DB::table('doctor_schedules')->whereIn('doctor_id', $doctorIds)->delete();
            // Null linked_user_id before deleting doctors to avoid FK violation with users
            DB::table('doctors')->where('tenant_id', $tenantId)->update(['linked_user_id' => null]);
        }
        DB::table('doctors')->where('tenant_id', $tenantId)->delete();
        DB::table('patients')->where('tenant_id', $tenantId)->delete();
        DB::table('receipt_settings')->where('tenant_id', $tenantId)->delete();
        DB::table('printers')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($branchIds)) {
            DB::table('daily_closings')->whereIn('branch_id', $branchIds)->delete();
            DB::table('income_entries')->whereIn('branch_id', $branchIds)->delete();
            DB::table('expenses')->whereIn('branch_id', $branchIds)->delete();
        }
        DB::table('expense_categories')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($stockTransIds)) {
            DB::table('stock_transfer_lines')->whereIn('stock_transfer_id', $stockTransIds)->delete();
        }
        if ($this->safe($warehouseIds)) {
            DB::table('stock_transfers')->whereIn('from_warehouse_id', $warehouseIds)->delete();
        }
        if ($this->safe($stockAdjIds)) {
            DB::table('stock_adjustment_lines')->whereIn('stock_adjustment_id', $stockAdjIds)->delete();
        }
        if ($this->safe($warehouseIds)) {
            DB::table('stock_adjustments')->whereIn('warehouse_id', $warehouseIds)->delete();
        }
        if ($this->safe($supplierPaymentIds)) {
            DB::table('supplier_payment_allocations')->whereIn('supplier_payment_id', $supplierPaymentIds)->delete();
        }
        if ($this->safe($supplierIds)) {
            DB::table('supplier_payments')->whereIn('supplier_id', $supplierIds)->delete();
            DB::table('supplier_invoices')->whereIn('supplier_id', $supplierIds)->delete();
        }
        if ($this->safe($goodsReceiptIds)) {
            DB::table('goods_receipt_lines')->whereIn('goods_receipt_id', $goodsReceiptIds)->delete();
        }
        if ($this->safe($warehouseIds)) {
            DB::table('goods_receipts')->whereIn('warehouse_id', $warehouseIds)->delete();
        }
        if ($this->safe($purchaseOrderIds)) {
            DB::table('purchase_order_lines')->whereIn('purchase_order_id', $purchaseOrderIds)->delete();
        }
        DB::table('purchase_orders')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($supplierIds)) {
            DB::table('supplier_ledger_entries')->whereIn('supplier_id', $supplierIds)->delete();
        }
        DB::table('suppliers')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($branchIds)) {
            DB::table('cash_drawer_sessions')->whereIn('branch_id', $branchIds)->delete();
        }
        if ($this->safe($invoiceLineIds)) {
            DB::table('invoice_line_batches')->whereIn('invoice_line_id', $invoiceLineIds)->delete();
        }
        if ($this->safe($invoiceIds)) {
            DB::table('payments')->whereIn('invoice_id', $invoiceIds)->delete();
            DB::table('invoice_lines')->whereIn('invoice_id', $invoiceIds)->delete();
        }
        if ($this->safe($branchIds)) {
            DB::table('invoices')->whereIn('branch_id', $branchIds)->delete();
        }
        if ($this->safe($giftCardIds)) {
            DB::table('gift_card_transactions')->whereIn('gift_card_id', $giftCardIds)->delete();
        }
        DB::table('gift_cards')->where('tenant_id', $tenantId)->delete();
        DB::table('coupons')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($customerIds)) {
            DB::table('loyalty_transactions')->whereIn('customer_id', $customerIds)->delete();
            DB::table('customer_ledger_entries')->whereIn('customer_id', $customerIds)->delete();
        }
        DB::table('customers')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($productIds)) {
            DB::table('serial_numbers')->whereIn('product_id', $productIds)->delete();
            DB::table('batches')->whereIn('product_id', $productIds)->delete();
        }
        if ($this->safe($warehouseIds)) {
            DB::table('stock_ledger')->whereIn('warehouse_id', $warehouseIds)->delete();
            DB::table('stock_levels')->whereIn('warehouse_id', $warehouseIds)->delete();
        }
        if ($this->safe($branchIds)) {
            DB::table('warehouses')->whereIn('branch_id', $branchIds)->delete();
        }
        if ($this->safe($productIds)) {
            DB::table('bundle_components')->whereIn('bundle_product_id', $productIds)->delete();
        }
        DB::table('products')->where('tenant_id', $tenantId)->delete();
        DB::table('categories')->where('tenant_id', $tenantId)->delete();
        DB::table('tax_templates')->where('tenant_id', $tenantId)->delete();
        if ($this->safe($userIds)) {
            DB::table('user_roles')->whereIn('user_id', $userIds)->delete();
        }
        if ($this->safe($roleIds)) {
            DB::table('role_permissions')->whereIn('role_id', $roleIds)->delete();
        }
        DB::table('users')->where('tenant_id', $tenantId)->delete();
        DB::table('roles')->where('tenant_id', $tenantId)->delete();
        DB::table('branches')->where('tenant_id', $tenantId)->delete();
    }

    private function insertAll(string $currentTenantId, string $sourceTenantId, array $tables): void
    {
        $substitute = $sourceTenantId !== $currentTenantId
            ? fn(array $row) => $this->substituteId($row, $sourceTenantId, $currentTenantId)
            : fn(array $row) => $row;

        // Insert in dependency order: parents before children
        $insert = function (string $table, array $rows) use ($substitute): void {
            if (empty($rows)) return;
            $prepared = array_map(fn($r) => $this->castJsonFields($table, $substitute($r)), $rows);
            foreach (array_chunk($prepared, 250) as $chunk) {
                DB::table($table)->insert($chunk);
            }
        };

        $insert('branches',                     $tables['branches']                     ?? []);
        $insert('users',                        $tables['users']                        ?? []);
        $insert('roles',                        $tables['roles']                        ?? []);
        $insert('role_permissions',             $tables['role_permissions']             ?? []);
        $insert('user_roles',                   $tables['user_roles']                   ?? []);
        $insert('tax_templates',                $tables['tax_templates']                ?? []);
        $insert('categories',                   $tables['categories']                   ?? []);
        $insert('products',                     $tables['products']                     ?? []);
        $insert('bundle_components',            $tables['bundle_components']            ?? []);
        $insert('warehouses',                   $tables['warehouses']                   ?? []);
        $insert('stock_levels',                 $tables['stock_levels']                 ?? []);
        $insert('stock_ledger',                 $tables['stock_ledger']                 ?? []);
        $insert('batches',                      $tables['batches']                      ?? []);
        $insert('serial_numbers',               $tables['serial_numbers']               ?? []);
        $insert('customers',                    $tables['customers']                    ?? []);
        $insert('customer_ledger_entries',      $tables['customer_ledger_entries']      ?? []);
        $insert('loyalty_transactions',         $tables['loyalty_transactions']         ?? []);
        $insert('coupons',                      $tables['coupons']                      ?? []);
        $insert('gift_cards',                   $tables['gift_cards']                   ?? []);
        $insert('gift_card_transactions',       $tables['gift_card_transactions']       ?? []);
        $insert('suppliers',                    $tables['suppliers']                    ?? []);
        $insert('supplier_ledger_entries',      $tables['supplier_ledger_entries']      ?? []);
        $insert('invoices',                     $tables['invoices']                     ?? []);
        $insert('invoice_lines',                $tables['invoice_lines']                ?? []);
        $insert('invoice_line_batches',         $tables['invoice_line_batches']         ?? []);
        $insert('payments',                     $tables['payments']                     ?? []);
        $insert('cash_drawer_sessions',         $tables['cash_drawer_sessions']         ?? []);
        $insert('purchase_orders',              $tables['purchase_orders']              ?? []);
        $insert('purchase_order_lines',         $tables['purchase_order_lines']         ?? []);
        $insert('goods_receipts',               $tables['goods_receipts']               ?? []);
        $insert('goods_receipt_lines',          $tables['goods_receipt_lines']          ?? []);
        $insert('supplier_invoices',            $tables['supplier_invoices']            ?? []);
        $insert('supplier_payments',            $tables['supplier_payments']            ?? []);
        $insert('supplier_payment_allocations', $tables['supplier_payment_allocations'] ?? []);
        $insert('stock_adjustments',            $tables['stock_adjustments']            ?? []);
        $insert('stock_adjustment_lines',       $tables['stock_adjustment_lines']       ?? []);
        $insert('stock_transfers',              $tables['stock_transfers']              ?? []);
        $insert('stock_transfer_lines',         $tables['stock_transfer_lines']         ?? []);
        $insert('expense_categories',           $tables['expense_categories']           ?? []);
        $insert('expenses',                     $tables['expenses']                     ?? []);
        $insert('income_entries',               $tables['income_entries']               ?? []);
        $insert('daily_closings',               $tables['daily_closings']               ?? []);
        $insert('printers',                     $tables['printers']                     ?? []);
        $insert('receipt_settings',             $tables['receipt_settings']             ?? []);
        $insert('doctors',                      $tables['doctors']                      ?? []);
        $insert('doctor_schedules',             $tables['doctor_schedules']             ?? []);
        $insert('patients',                     $tables['patients']                     ?? []);
        $insert('appointments',                 $tables['appointments']                 ?? []);
        $insert('patient_ledger_entries',       $tables['patient_ledger_entries']       ?? []);
        $insert('appointment_bills',            $tables['appointment_bills']            ?? []);
        $insert('appointment_bill_lines',       $tables['appointment_bill_lines']       ?? []);
        $insert('appointment_bill_payments',    $tables['appointment_bill_payments']    ?? []);
    }

    private function substituteId(array $row, string $oldId, string $newId): array
    {
        $json = str_replace('"' . $oldId . '"', '"' . $newId . '"', json_encode($row));
        return json_decode($json, true);
    }

    // PostgreSQL stores jsonb as string in the query builder result; re-encode as string for insert
    private function castJsonFields(string $table, array $row): array
    {
        $jsonbColumns = [
            'products'       => ['variant_attributes'],
            'tenant_modules' => ['limits'],
            'snapshot_data'  => ['snapshot_data'],
        ];
        foreach ($jsonbColumns[$table] ?? [] as $col) {
            if (isset($row[$col]) && is_array($row[$col])) {
                $row[$col] = json_encode($row[$col]);
            }
        }
        return $row;
    }

    private function placeholder(array $ids): string
    {
        return implode(',', array_fill(0, max(1, count($ids)), '?'));
    }
}
