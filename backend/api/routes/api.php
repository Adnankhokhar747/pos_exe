<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\LicenseController;
use App\Http\Controllers\Platform\PlatformAuthController;
use App\Http\Controllers\Platform\CompaniesController;
use App\Http\Controllers\Platform\PlansController;
use App\Http\Controllers\Platform\ModuleCatalogController;
use App\Http\Controllers\Platform\CompanyBackupController;
use App\Http\Controllers\Identity\BranchesController;
use App\Http\Controllers\Identity\UsersController;
use App\Http\Controllers\Identity\RolesController;
use App\Http\Controllers\Identity\ModuleStatusController;
use App\Http\Controllers\POS\ProductsController;
use App\Http\Controllers\POS\CategoriesController;
use App\Http\Controllers\POS\CustomersController;
use App\Http\Controllers\POS\InvoicesController;
use App\Http\Controllers\POS\SuppliersController;
use App\Http\Controllers\POS\PurchaseOrdersController;
use App\Http\Controllers\POS\GoodsReceiptsController;
use App\Http\Controllers\POS\CouponsController;
use App\Http\Controllers\POS\GiftCardsController;
use App\Http\Controllers\POS\SupplierInvoicesController;
use App\Http\Controllers\POS\SupplierPaymentsController;
use App\Http\Controllers\Inventory\StockAdjustmentsController;
use App\Http\Controllers\Inventory\StockTransfersController;
use App\Http\Controllers\Inventory\BatchesController;
use App\Http\Controllers\Inventory\SerialNumbersController;
use App\Http\Controllers\Hospital\DoctorsController;
use App\Http\Controllers\Hospital\PatientsController;
use App\Http\Controllers\Hospital\AppointmentsController;
use App\Http\Controllers\Hospital\AppointmentBillingController;
use App\Http\Controllers\Hospital\QueueController;
use App\Http\Controllers\Hospital\HospitalReportsController;
use App\Http\Controllers\Reports\ReportsController;
use App\Http\Controllers\Settings\SettingsController;
use App\Http\Controllers\Settings\AccountingController;
use App\Http\Controllers\Settings\TenantSettingsController;
use App\Http\Controllers\Settings\TaxTemplatesController;
use App\Http\Controllers\Settings\CurrenciesController;
use App\Http\Controllers\Backup\BackupController;
use App\Http\Controllers\Booking\BookingAuthController;
use App\Http\Controllers\Booking\BookingPublicController;
use App\Http\Controllers\Booking\BookingAppointmentController;
use App\Http\Controllers\Lease\LeasePropertiesController;
use App\Http\Controllers\Lease\LeaseAgreementsController;
use App\Http\Controllers\Lease\LeaseReportsController;

// ─── Online Patient Booking (public, no staff auth) ───────────────────────────
Route::prefix('v1/booking')->group(function () {
    Route::get('/default-tenant',  [BookingPublicController::class, 'defaultTenant']);
    Route::post('/auth/register', [BookingAuthController::class, 'register']);
    Route::post('/auth/login',    [BookingAuthController::class, 'login']);
    Route::get('/doctors',        [BookingPublicController::class, 'doctors']);
    Route::get('/doctors/{id}/availability', [BookingPublicController::class, 'availability']);

    Route::middleware(\App\Http\Middleware\BookingAuthMiddleware::class)->group(function () {
        Route::get('/auth/me',               [BookingAuthController::class, 'me']);
        Route::get('/appointments',          [BookingAppointmentController::class, 'myAppointments']);
        Route::post('/appointments',         [BookingAppointmentController::class, 'book']);
        Route::post('/appointments/{id}/cancel', [BookingAppointmentController::class, 'cancel']);
    });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
Route::prefix('v1/auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::middleware('jwt.auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// ─── Platform Admin ────────────────────────────────────────────────────────────
Route::prefix('v1/platform')->middleware('platform.auth')->group(function () {
    Route::post('/auth/login', [PlatformAuthController::class, 'login'])->withoutMiddleware('platform.auth');
    Route::get('/auth/me', [PlatformAuthController::class, 'me']);

    Route::apiResource('plans', PlansController::class)->except(['destroy']);

    Route::prefix('modules')->group(function () {
        Route::get('/', [ModuleCatalogController::class, 'index']);
        Route::post('/', [ModuleCatalogController::class, 'store']);
        Route::patch('/{id}', [ModuleCatalogController::class, 'update']);
    });

    Route::prefix('companies')->group(function () {
        Route::get('/', [CompaniesController::class, 'index']);
        Route::post('/', [CompaniesController::class, 'store']);
        Route::get('/{id}', [CompaniesController::class, 'show']);
        Route::patch('/{id}', [CompaniesController::class, 'update']);
        Route::delete('/{id}', [CompaniesController::class, 'destroy']);
        Route::patch('/{id}/activate', [CompaniesController::class, 'activate']);
        Route::patch('/{id}/suspend', [CompaniesController::class, 'suspend']);
        Route::get('/{id}/subscription', [CompaniesController::class, 'getSubscription']);
        Route::patch('/{id}/subscription/plan', [CompaniesController::class, 'assignPlan']);
        Route::post('/{id}/subscription/renew', [CompaniesController::class, 'renewSubscription']);
        Route::get('/{id}/users', [CompaniesController::class, 'getUsers']);
        Route::get('/{id}/modules', [ModuleCatalogController::class, 'listForCompany']);
        Route::patch('/{id}/modules/{moduleCode}', [ModuleCatalogController::class, 'upsertForCompany']);

        // ─── Cloud Backup (per company, platform admin) ───────────────────────
        Route::get('/{id}/backup', [CompanyBackupController::class, 'show']);
        Route::patch('/{id}/backup', [CompanyBackupController::class, 'update']);
        Route::post('/{id}/backup/create', [CompanyBackupController::class, 'createSnapshot']);
        Route::get('/{id}/backup/snapshots', [CompanyBackupController::class, 'snapshots']);
        Route::get('/{id}/backup/snapshots/{snapshotId}/download', [CompanyBackupController::class, 'downloadSnapshot']);
    });
});

// ─── License status (before license guard — can't be behind its own gate) ─────
Route::middleware('jwt.auth')->group(function () {
    Route::get('/v1/license/status', [LicenseController::class, 'status']);
    Route::get('/v1/modules/status', [ModuleStatusController::class, 'status']);
});

// ─── Tenant-facing API ──────────────────────────────────────────────────────────
Route::prefix('v1')->middleware(['jwt.auth', 'license'])->group(function () {

    // ─── Identity ─────────────────────────────────────────────────────────────
    Route::apiResource('branches', BranchesController::class);
    Route::apiResource('roles', RolesController::class)->except(['destroy']);
    Route::get('/roles/{id}/permissions', [RolesController::class, 'permissions']);
    Route::get('/users', [UsersController::class, 'index']);
    Route::post('/users', [UsersController::class, 'store'])->middleware('permission:user.manage');
    Route::get('/users/{id}', [UsersController::class, 'show']);
    Route::patch('/users/{id}', [UsersController::class, 'update'])->middleware('permission:user.manage');
    Route::delete('/users/{id}', [UsersController::class, 'destroy'])->middleware('permission:user.manage');
    Route::post('/users/{id}/change-password', [UsersController::class, 'changePassword']);

    // ─── Products ────────────────────────────────────────────────────────────
    Route::prefix('products')->group(function () {
        Route::get('/pos-grid', [ProductsController::class, 'posGrid']);
        Route::get('/by-barcode', [ProductsController::class, 'byBarcode']);
        Route::get('/', [ProductsController::class, 'index']);
        Route::post('/', [ProductsController::class, 'store'])->middleware('permission:product.manage');
        Route::get('/{id}/variants', [ProductsController::class, 'variants']);
        Route::get('/{id}/bundle-components', [ProductsController::class, 'bundleComponents']);
        Route::put('/{id}/bundle-components', [ProductsController::class, 'updateBundleComponents'])->middleware('permission:product.manage');
        Route::get('/{id}', [ProductsController::class, 'show']);
        Route::patch('/{id}', [ProductsController::class, 'update'])->middleware('permission:product.manage');
        Route::delete('/{id}', [ProductsController::class, 'destroy'])->middleware('permission:product.manage');
    });

    // ─── Categories ───────────────────────────────────────────────────────────
    Route::prefix('categories')->group(function () {
        Route::get('/', [CategoriesController::class, 'index']);
        Route::get('/{id}', [CategoriesController::class, 'show']);
        Route::post('/', [CategoriesController::class, 'store'])->middleware('permission:product.manage');
        Route::patch('/{id}', [CategoriesController::class, 'update'])->middleware('permission:product.manage');
        Route::delete('/{id}', [CategoriesController::class, 'destroy'])->middleware('permission:product.manage');
    });

    // ─── Customers ────────────────────────────────────────────────────────────
    Route::prefix('customers')->group(function () {
        Route::get('/', [CustomersController::class, 'index']);
        Route::post('/', [CustomersController::class, 'store'])->middleware('permission:customer.manage');
        Route::get('/{id}', [CustomersController::class, 'show']);
        Route::patch('/{id}', [CustomersController::class, 'update'])->middleware('permission:customer.manage');
        Route::get('/{id}/ledger', [CustomersController::class, 'ledger']);
        Route::get('/{id}/loyalty-transactions', [CustomersController::class, 'loyaltyTransactions']);
        Route::post('/{id}/payments', [CustomersController::class, 'recordPayment'])->middleware('permission:customer.manage');
        Route::post('/{id}/payment', [CustomersController::class, 'recordPayment'])->middleware('permission:customer.manage');
    });

    // ─── Coupons ─────────────────────────────────────────────────────────────
    Route::prefix('coupons')->group(function () {
        Route::get('/validate', [CouponsController::class, 'validate']);
        Route::get('/', [CouponsController::class, 'index']);
        Route::post('/', [CouponsController::class, 'store'])->middleware('permission:settings.manage');
        Route::get('/{id}', [CouponsController::class, 'show']);
        Route::patch('/{id}', [CouponsController::class, 'update'])->middleware('permission:settings.manage');
        Route::delete('/{id}', [CouponsController::class, 'destroy'])->middleware('permission:settings.manage');
    });

    // ─── Gift Cards ───────────────────────────────────────────────────────────
    Route::prefix('gift-cards')->group(function () {
        Route::get('/', [GiftCardsController::class, 'index']);
        Route::post('/', [GiftCardsController::class, 'store'])->middleware('permission:settings.manage');
        Route::get('/{code}/balance', [GiftCardsController::class, 'getBalance']);
        Route::post('/{code}/reload', [GiftCardsController::class, 'reload'])->middleware('permission:settings.manage');
        Route::get('/{id}', [GiftCardsController::class, 'show']);
        Route::patch('/{id}', [GiftCardsController::class, 'update'])->middleware('permission:settings.manage');
        Route::delete('/{id}', [GiftCardsController::class, 'destroy'])->middleware('permission:settings.manage');
    });

    // ─── Invoices ────────────────────────────────────────────────────────────
    Route::prefix('invoices')->group(function () {
        Route::get('/held', [InvoicesController::class, 'listHeld']);
        Route::post('/hold', [InvoicesController::class, 'hold'])->middleware('permission:invoice.create');
        Route::get('/', [InvoicesController::class, 'index']);
        Route::post('/', [InvoicesController::class, 'store'])->middleware('permission:invoice.create');
        Route::get('/{id}', [InvoicesController::class, 'show']);
        Route::patch('/{id}', [InvoicesController::class, 'update'])->middleware('permission:invoice.create');
        Route::post('/{id}/void', [InvoicesController::class, 'void'])->middleware('permission:invoice.void');
        Route::post('/{id}/resume', [InvoicesController::class, 'resume']);
        Route::post('/{id}/returns', [InvoicesController::class, 'createReturn'])->middleware('permission:invoice.create');
    });

    // ─── Suppliers ────────────────────────────────────────────────────────────
    Route::prefix('suppliers')->group(function () {
        Route::get('/', [SuppliersController::class, 'index']);
        Route::post('/', [SuppliersController::class, 'store'])->middleware('permission:supplier.manage');
        Route::get('/{id}', [SuppliersController::class, 'show']);
        Route::patch('/{id}', [SuppliersController::class, 'update'])->middleware('permission:supplier.manage');
        Route::get('/{id}/ledger', [SuppliersController::class, 'ledger']);
    });

    // ─── Supplier Invoices & Payments ─────────────────────────────────────────
    Route::prefix('supplier-invoices')->group(function () {
        Route::get('/', [SupplierInvoicesController::class, 'index']);
        Route::post('/', [SupplierInvoicesController::class, 'store'])->middleware('permission:purchase.manage');
        Route::get('/{id}', [SupplierInvoicesController::class, 'show']);
        Route::post('/{id}/pay', [SupplierInvoicesController::class, 'pay'])->middleware('permission:purchase.manage');
    });

    Route::prefix('goods-receipts')->group(function () {
        Route::get('/', [GoodsReceiptsController::class, 'index']);
        Route::post('/', [GoodsReceiptsController::class, 'store'])->middleware('permission:purchase.manage');
        Route::get('/{id}', [GoodsReceiptsController::class, 'show']);
    });

    Route::prefix('supplier-payments')->group(function () {
        Route::get('/', [SupplierPaymentsController::class, 'index']);
        Route::post('/', [SupplierPaymentsController::class, 'store'])->middleware('permission:purchase.manage');
    });

    // ─── Purchase Orders ──────────────────────────────────────────────────────
    Route::prefix('purchase-orders')->middleware('permission:purchase.manage')->group(function () {
        Route::get('/', [PurchaseOrdersController::class, 'index']);
        Route::post('/', [PurchaseOrdersController::class, 'store']);
        Route::get('/{id}', [PurchaseOrdersController::class, 'show']);
        Route::post('/{id}/send', [PurchaseOrdersController::class, 'send']);
        Route::post('/{id}/pay', [PurchaseOrdersController::class, 'pay']);
        Route::post('/{id}/receive', [PurchaseOrdersController::class, 'receiveGoods']);
    });

    // ─── Inventory ────────────────────────────────────────────────────────────
    Route::prefix('stock-adjustments')->group(function () {
        Route::get('/', [StockAdjustmentsController::class, 'index']);
        Route::post('/', [StockAdjustmentsController::class, 'store'])->middleware('permission:inventory.adjust');
        Route::get('/{id}', [StockAdjustmentsController::class, 'show']);
    });

    Route::prefix('stock-transfers')->group(function () {
        Route::get('/', [StockTransfersController::class, 'index']);
        Route::post('/', [StockTransfersController::class, 'store'])->middleware('permission:inventory.adjust');
        Route::get('/{id}', [StockTransfersController::class, 'show']);
        Route::post('/{id}/dispatch', [StockTransfersController::class, 'dispatch'])->middleware('permission:inventory.adjust');
        Route::post('/{id}/receive', [StockTransfersController::class, 'receive'])->middleware('permission:inventory.adjust');
    });

    Route::prefix('batches')->group(function () {
        Route::get('/expiring', [BatchesController::class, 'expiring']);
        Route::get('/', [BatchesController::class, 'index']);
        Route::get('/{id}', [BatchesController::class, 'show']);
    });

    Route::prefix('serial-numbers')->group(function () {
        Route::get('/', [SerialNumbersController::class, 'index']);
        Route::get('/{id}', [SerialNumbersController::class, 'show']);
    });

    // ─── Reports ──────────────────────────────────────────────────────────────
    Route::prefix('reports')->middleware('permission:report.view')->group(function () {
        Route::get('/sales-summary', [ReportsController::class, 'salesSummary']);
        Route::get('/payment-methods', [ReportsController::class, 'paymentMethods']);
        Route::get('/dashboard-stats', [ReportsController::class, 'dashboardStats']);
        Route::get('/stock-valuation', [ReportsController::class, 'stockValuation']);
        Route::get('/inventory-valuation', [ReportsController::class, 'stockValuation']);
        Route::get('/top-products', [ReportsController::class, 'topProducts']);
        Route::get('/daily-closing-summary', [ReportsController::class, 'dailyClosingSummary']);
        Route::get('/low-stock', [ReportsController::class, 'lowStock']);
    });

    // ─── Settings ─────────────────────────────────────────────────────────────
    Route::get('/settings/tenant', [TenantSettingsController::class, 'get']);
    Route::patch('/settings/tenant', [TenantSettingsController::class, 'update'])->middleware('permission:settings.manage');
    Route::get('/settings/receipt-settings', [SettingsController::class, 'getReceiptSettings']);
    Route::patch('/settings/receipt-settings', [SettingsController::class, 'updateReceiptSettings'])->middleware('permission:settings.manage');
    Route::prefix('settings/printers')->group(function () {
        Route::get('/', [SettingsController::class, 'getPrinters']);
        Route::post('/', [SettingsController::class, 'createPrinter'])->middleware('permission:settings.manage');
        Route::patch('/{id}', [SettingsController::class, 'updatePrinter'])->middleware('permission:settings.manage');
        Route::delete('/{id}', [SettingsController::class, 'deletePrinter'])->middleware('permission:settings.manage');
    });

    // ─── Tax Templates ────────────────────────────────────────────────────────
    Route::prefix('tax-templates')->group(function () {
        Route::get('/', [TaxTemplatesController::class, 'index']);
        Route::post('/', [TaxTemplatesController::class, 'store'])->middleware('permission:settings.manage');
        Route::get('/{id}', [TaxTemplatesController::class, 'show']);
        Route::patch('/{id}', [TaxTemplatesController::class, 'update'])->middleware('permission:settings.manage');
        Route::delete('/{id}', [TaxTemplatesController::class, 'destroy'])->middleware('permission:settings.manage');
    });

    // ─── Currencies ───────────────────────────────────────────────────────────
    Route::prefix('currencies')->group(function () {
        Route::get('/', [CurrenciesController::class, 'index']);
        Route::post('/', [CurrenciesController::class, 'upsert'])->middleware('permission:settings.manage');
        Route::get('/{code}/exchange-rates', [CurrenciesController::class, 'listExchangeRates']);
        Route::post('/{code}/exchange-rates', [CurrenciesController::class, 'recordExchangeRate'])->middleware('permission:settings.manage');
        Route::get('/{code}', [CurrenciesController::class, 'show']);
        Route::patch('/{code}', [CurrenciesController::class, 'update'])->middleware('permission:settings.manage');
        Route::delete('/{code}', [CurrenciesController::class, 'destroy'])->middleware('permission:settings.manage');
    });

    // ─── Accounting ───────────────────────────────────────────────────────────
    Route::prefix('expenses')->group(function () {
        Route::get('/', [AccountingController::class, 'listExpenses']);
        Route::post('/', [AccountingController::class, 'createExpense'])->middleware('permission:expense.manage');
        Route::post('/{id}/void', [AccountingController::class, 'voidExpense'])->middleware('permission:expense.manage');
    });
    Route::prefix('expense-categories')->group(function () {
        Route::get('/', [AccountingController::class, 'listExpenseCategories']);
        Route::post('/', [AccountingController::class, 'createExpenseCategory'])->middleware('permission:expense.manage');
    });
    Route::prefix('income-entries')->group(function () {
        Route::get('/', [AccountingController::class, 'listIncome']);
        Route::post('/', [AccountingController::class, 'createIncome'])->middleware('permission:expense.manage');
    });
    Route::prefix('daily-closings')->group(function () {
        Route::get('/', [AccountingController::class, 'listDailyClosings']);
        Route::post('/', [AccountingController::class, 'createDailyClosing'])->middleware('permission:settings.manage');
    });
    Route::prefix('cash-drawer')->group(function () {
        Route::get('/open', [AccountingController::class, 'getOpenDrawer']);
        Route::post('/open', [AccountingController::class, 'openDrawer'])->middleware('permission:cash.manage');
        Route::post('/{id}/close', [AccountingController::class, 'closeDrawer'])->middleware('permission:cash.manage');
    });

    Route::get('/reports/profit-summary', [AccountingController::class, 'getProfitSummary'])->middleware('permission:report.view');

    // ─── Hospital Module ───────────────────────────────────────────────────────
    Route::prefix('hospital')->middleware('module:hospital')->group(function () {

        Route::get('/queue', [QueueController::class, 'queue']);

        Route::prefix('doctors')->group(function () {
            Route::get('/linkable-users', [DoctorsController::class, 'linkableUsers']);
            Route::get('/', [DoctorsController::class, 'index']);
            Route::post('/', [DoctorsController::class, 'store'])->middleware('permission:hospital.doctor.manage');
            Route::get('/{id}', [DoctorsController::class, 'show']);
            Route::patch('/{id}', [DoctorsController::class, 'update'])->middleware('permission:hospital.doctor.manage');
            Route::delete('/{id}', [DoctorsController::class, 'destroy'])->middleware('permission:hospital.doctor.manage');
            Route::get('/{id}/schedule', [DoctorsController::class, 'getSchedule']);
            Route::put('/{id}/schedule', [DoctorsController::class, 'updateSchedule'])->middleware('permission:hospital.doctor.manage');
            Route::patch('/{id}/schedule', [DoctorsController::class, 'updateSchedule'])->middleware('permission:hospital.doctor.manage');
        });

        Route::prefix('patients')->group(function () {
            Route::get('/', [PatientsController::class, 'index']);
            Route::post('/', [PatientsController::class, 'store'])->middleware('permission:hospital.patient.manage');
            Route::get('/{id}', [PatientsController::class, 'show']);
            Route::patch('/{id}', [PatientsController::class, 'update'])->middleware('permission:hospital.patient.manage');
            Route::delete('/{id}', [PatientsController::class, 'destroy'])->middleware('permission:hospital.patient.manage');
            Route::post('/{id}/advance', [PatientsController::class, 'recordAdvance'])->middleware('permission:hospital.appointment.manage');
            Route::post('/{id}/refund', [PatientsController::class, 'refund'])->middleware('permission:hospital.appointment.manage');
            Route::post('/{id}/settle-treatment', [PatientsController::class, 'settleTreatment'])->middleware('permission:hospital.appointment.manage');
            Route::post('/{id}/settle', [PatientsController::class, 'settleTreatment'])->middleware('permission:hospital.appointment.manage');
            Route::get('/{id}/ledger', [PatientsController::class, 'ledger']);
            Route::get('/{id}/pos-invoices', [PatientsController::class, 'posInvoices']);
            Route::get('/{id}/appointments', [PatientsController::class, 'appointments']);
        });

        Route::prefix('appointments')->group(function () {
            Route::get('/', [AppointmentsController::class, 'index']);
            Route::post('/', [AppointmentsController::class, 'store'])->middleware('permission:hospital.appointment.manage');
            Route::get('/{id}', [AppointmentsController::class, 'show']);
            Route::patch('/{id}/status', [AppointmentsController::class, 'updateStatus'])->middleware('permission:hospital.appointment.manage');
            Route::get('/{id}/bill', [AppointmentBillingController::class, 'getBill']);
            Route::post('/{id}/bill/draft', [AppointmentBillingController::class, 'saveDraft'])->middleware('permission:hospital.appointment.manage');
            Route::post('/{id}/bill/finalize', [AppointmentBillingController::class, 'finalizeBill'])->middleware('permission:hospital.appointment.manage');
            Route::put('/{id}/bill', [AppointmentBillingController::class, 'saveDraft'])->middleware('permission:hospital.appointment.manage');
            Route::post('/{id}/bill', [AppointmentBillingController::class, 'finalizeBill'])->middleware('permission:hospital.appointment.manage');
        });

        Route::prefix('reports')->middleware('permission:hospital.report.view')->group(function () {
            Route::get('/counts', [HospitalReportsController::class, 'counts']);
            Route::get('/summary', [HospitalReportsController::class, 'summary']);
            Route::get('/daily-patients', [HospitalReportsController::class, 'dailyPatients']);
            Route::get('/monthly-patients', [HospitalReportsController::class, 'monthlyPatients']);
            Route::get('/revenue', [HospitalReportsController::class, 'revenue']);
        });
    });

    // ─── Lease Module ─────────────────────────────────────────────────────────────
    Route::prefix('lease')->middleware('module:lease')->group(function () {

        Route::prefix('properties')->group(function () {
            Route::get('/',      [LeasePropertiesController::class, 'index']);
            Route::post('/',     [LeasePropertiesController::class, 'store'])->middleware('permission:lease.property.manage');
            Route::get('/{id}',  [LeasePropertiesController::class, 'show']);
            Route::patch('/{id}',[LeasePropertiesController::class, 'update'])->middleware('permission:lease.property.manage');
        });

        Route::prefix('agreements')->group(function () {
            Route::get('/',                         [LeaseAgreementsController::class, 'index']);
            Route::post('/',                        [LeaseAgreementsController::class, 'store'])->middleware('permission:lease.agreement.manage');
            Route::get('/{id}',                     [LeaseAgreementsController::class, 'show']);
            Route::patch('/{id}',                   [LeaseAgreementsController::class, 'update'])->middleware('permission:lease.agreement.manage');
            Route::get('/{id}/payments',            [LeaseAgreementsController::class, 'payments']);
            Route::post('/{id}/payments',           [LeaseAgreementsController::class, 'recordPayment'])->middleware('permission:lease.agreement.manage');
        });

        Route::prefix('reports')->middleware('permission:lease.report.view')->group(function () {
            Route::get('/summary',  [LeaseReportsController::class, 'summary']);
            Route::get('/expiring', [LeaseReportsController::class, 'expiring']);
            Route::get('/payments', [LeaseReportsController::class, 'payments']);
        });
    });

    // ─── Cloud Backup (tenant-facing) ─────────────────────────────────────────
    Route::prefix('backup')->group(function () {
        Route::get('/status', [BackupController::class, 'status']);
        // Local backup — free, no server storage, no permission gate
        Route::get('/export', [BackupController::class, 'export']);
        // Cloud backup — server-stored snapshots, requires settings.manage
        Route::post('/create', [BackupController::class, 'create'])->middleware('permission:settings.manage');
        Route::get('/snapshots', [BackupController::class, 'snapshots']);
        Route::get('/snapshots/{id}/download', [BackupController::class, 'download'])->middleware('permission:settings.manage');
        Route::post('/snapshots/{id}/restore', [BackupController::class, 'restore'])->middleware('permission:settings.manage');
        Route::post('/import', [BackupController::class, 'import'])->middleware('permission:settings.manage');
        Route::delete('/snapshots/{id}', [BackupController::class, 'deleteSnapshot'])->middleware('permission:settings.manage');
    });
});
