<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\IncomeEntry;
use App\Models\DailyClosing;
use App\Models\CashDrawerSession;
use App\Models\Branch;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class AccountingController extends Controller
{
    // ---------- Expenses ----------
    public function listExpenses(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return Expense::whereIn('branch_id', $branchIds)
            ->whereNull('voided_at')
            ->with('category')
            ->when($request->from, fn($q,$f) => $q->where('occurred_at','>=',$f))
            ->when($request->to, fn($q,$t) => $q->where('occurred_at','<=',$t))
            ->when($request->branchId, fn($q,$b) => $q->where('branch_id',$b))
            ->orderByDesc('occurred_at')
            ->limit(500)
            ->get();
    }

    public function createExpense(Request $request)
    {
        $request->validate([
            'branchId'   => 'required|uuid',
            'categoryId' => 'required|uuid',
            'amount'     => 'required|numeric|min:0.01',
            'paidVia'    => 'required|string',
        ]);

        return Expense::create([
            'id'          => (string) \Illuminate\Support\Str::uuid(),
            'branch_id'   => $request->branchId,
            'category_id' => $request->categoryId,
            'amount'      => $request->amount,
            'note'        => $request->note,
            'paid_via'    => $request->paidVia,
        ]);
    }

    public function voidExpense(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $expense = Expense::whereIn('branch_id', $branchIds)->find($id);
        if (!$expense) throw new NotFoundException("Expense {$id} not found.");
        if ($expense->voided_at) throw new ConflictException('Expense already voided.');

        $expense->update([
            'voided_at'  => now(),
            'voided_by'  => $request->user()->id,
            'void_reason'=> $request->reason,
        ]);
        return $expense;
    }

    // ---------- Expense Categories ----------
    public function listExpenseCategories(Request $request)
    {
        return ExpenseCategory::where('tenant_id', $request->user()->tenant_id)->orderBy('name')->get();
    }

    public function createExpenseCategory(Request $request)
    {
        $request->validate(['name' => 'required|string']);
        return ExpenseCategory::create([
            'id'        => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $request->user()->tenant_id,
            'name'      => $request->name,
        ]);
    }

    // ---------- Income ----------
    public function listIncome(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return IncomeEntry::whereIn('branch_id', $branchIds)
            ->whereNull('voided_at')
            ->when($request->branchId, fn($q,$b) => $q->where('branch_id',$b))
            ->orderByDesc('occurred_at')
            ->limit(500)
            ->get();
    }

    public function createIncome(Request $request)
    {
        $request->validate([
            'branchId' => 'required|uuid',
            'category' => 'required|string',
            'amount'   => 'required|numeric|min:0.01',
        ]);

        return IncomeEntry::create([
            'id'        => (string) \Illuminate\Support\Str::uuid(),
            'branch_id' => $request->branchId,
            'category'  => $request->category,
            'amount'    => $request->amount,
            'note'      => $request->note,
        ]);
    }

    // ---------- Daily Closing ----------
    public function listDailyClosings(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return DailyClosing::whereIn('branch_id', $branchIds)
            ->whereNull('voided_at')
            ->when($request->branchId, fn($q,$b) => $q->where('branch_id',$b))
            ->orderByDesc('business_date')
            ->limit(200)
            ->get();
    }

    public function createDailyClosing(Request $request)
    {
        $request->validate([
            'branchId'    => 'required|uuid',
            'businessDate'=> 'required|date',
            'countedCash' => 'required|numeric|min:0',
        ]);

        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        // Calculate expected cash from invoices + income - expenses
        $invoices = Invoice::where('branch_id', $request->branchId)
            ->where('status','completed')
            ->whereDate('created_at', $request->businessDate)
            ->with('payments')
            ->get();

        $cashFromSales = $invoices->flatMap->payments->where('method','cash')->sum('amount');
        $expenseCash   = Expense::where('branch_id', $request->branchId)
            ->where('paid_via','cash')
            ->whereDate('occurred_at', $request->businessDate)
            ->whereNull('voided_at')
            ->sum('amount');
        $incomeCash    = IncomeEntry::where('branch_id', $request->branchId)
            ->whereDate('occurred_at', $request->businessDate)
            ->whereNull('voided_at')
            ->sum('amount');

        $expectedCash = (float)$cashFromSales - (float)$expenseCash + (float)$incomeCash;
        $variance = (float)$request->countedCash - $expectedCash;

        $closing = DailyClosing::create([
            'id'            => (string) \Illuminate\Support\Str::uuid(),
            'branch_id'     => $request->branchId,
            'business_date' => $request->businessDate,
            'expected_cash' => $expectedCash,
            'counted_cash'  => $request->countedCash,
            'variance'      => $variance,
            'closed_by'     => $request->user()->id,
        ]);

        return $closing;
    }

    // ---------- Cash Drawer ----------
    public function openDrawer(Request $request)
    {
        $request->validate(['branchId' => 'required|uuid', 'openingFloat' => 'required|numeric|min:0']);

        return CashDrawerSession::create([
            'id'            => (string) \Illuminate\Support\Str::uuid(),
            'branch_id'     => $request->branchId,
            'opened_by'     => $request->user()->id,
            'opening_float' => $request->openingFloat,
        ]);
    }

    public function closeDrawer(Request $request, string $id)
    {
        $request->validate(['closingCount' => 'required|numeric|min:0']);

        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');
        $session = CashDrawerSession::whereIn('branch_id', $branchIds)->whereNull('closed_at')->find($id);
        if (!$session) throw new NotFoundException("Cash drawer session {$id} not found or already closed.");

        // Calculate expected
        $invoices = Invoice::where('branch_id', $session->branch_id)
            ->where('status','completed')
            ->where('created_at','>=', $session->opened_at)
            ->with('payments')
            ->get();
        $cashFromSales = $invoices->flatMap->payments->where('method','cash')->sum('amount');
        $expectedClose = (float)$session->opening_float + (float)$cashFromSales;
        $variance = (float)$request->closingCount - $expectedClose;

        $session->update([
            'closed_by'     => $request->user()->id,
            'closing_count' => $request->closingCount,
            'expected_close'=> $expectedClose,
            'variance'      => $variance,
            'closed_at'     => now(),
        ]);

        return $session;
    }

    public function getOpenDrawer(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        return CashDrawerSession::whereIn('branch_id', $branchIds)
            ->whereNull('closed_at')
            ->when($request->branchId, fn($q,$b) => $q->where('branch_id',$b))
            ->latest('opened_at')
            ->first();
    }

    public function getProfitSummary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $fromStr  = $request->from ?? null;
        $toStr    = $request->to   ?? null;
        // Expand date-only strings to full-day range
        if ($fromStr && strlen($fromStr) === 10) $fromStr .= ' 00:00:00';
        if ($toStr   && strlen($toStr)   === 10) $toStr   .= ' 23:59:59';
        $from = $fromStr ?? now()->startOfMonth()->toDateTimeString();
        $to   = $toStr   ?? now()->endOfDay()->toDateTimeString();

        $branchIds = Branch::where('tenant_id', $tenantId)
            ->when($request->branchId, fn($q,$b) => $q->where('id', $b))
            ->pluck('id');

        // Revenue from completed invoices
        $invoices = Invoice::whereIn('branch_id', $branchIds)
            ->where('status','completed')
            ->whereBetween('created_at', [$from, $to])
            ->get(['invoice_type','grand_total']);

        $revenue = $invoices->reduce(function($sum, $inv) {
            return $sum + ($inv->invoice_type === 'sale' ? (float)$inv->grand_total : -(float)$inv->grand_total);
        }, 0.0);

        // COGS from stock ledger
        $cogs = DB::table('stock_ledger as sle')
            ->join('warehouses as w', 'w.id', '=', 'sle.warehouse_id')
            ->whereIn('w.branch_id', $branchIds)
            ->whereIn('sle.movement_type', ['sale', 'sale_return'])
            ->whereBetween('sle.occurred_at', [$from, $to])
            ->selectRaw('SUM(-sle.quantity_delta * sle.unit_cost_at_movement) as cogs')
            ->value('cogs') ?? 0;

        $expenses = Expense::whereIn('branch_id', $branchIds)
            ->whereBetween('occurred_at', [$from, $to])
            ->whereNull('voided_at')
            ->sum('amount');

        $otherIncome = IncomeEntry::whereIn('branch_id', $branchIds)
            ->whereBetween('occurred_at', [$from, $to])
            ->whereNull('voided_at')
            ->sum('amount');

        $grossProfit = $revenue - (float)$cogs;
        $netProfit   = $grossProfit + (float)$otherIncome - (float)$expenses;

        return response()->json([
            'revenue'     => (string) round($revenue, 4),
            'cogs'        => (string) round((float)$cogs, 4),
            'grossProfit' => (string) round($grossProfit, 4),
            'otherIncome' => (string) round((float)$otherIncome, 4),
            'expenses'    => (string) round((float)$expenses, 4),
            'netProfit'   => (string) round($netProfit, 4),
        ]);
    }
}
