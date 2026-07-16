<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Invoice;
use App\Models\Branch;
use App\Models\StockLevel;
use App\Models\Product;
use App\Models\Expense;
use App\Models\IncomeEntry;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    private function dateRange(Request $request): array
    {
        $from = $request->from;
        $to   = $request->to;
        // If only a date (YYYY-MM-DD) is supplied, expand to full-day range
        if ($from && strlen($from) === 10) $from .= ' 00:00:00';
        if ($to   && strlen($to)   === 10) $to   .= ' 23:59:59';
        $from = $from ?? now()->startOfDay()->toDateTimeString();
        $to   = $to   ?? now()->endOfDay()->toDateTimeString();
        return [$from, $to];
    }

    public function salesSummary(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        [$from, $to] = $this->dateRange($request);

        $branchIds = Branch::where('tenant_id', $tenantId)
            ->when($request->branchId, fn($q,$b) => $q->where('id', $b))
            ->pluck('id');

        $invoices = Invoice::whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->where('invoice_type', 'sale')
            ->whereBetween('created_at', [$from, $to])
            ->with(['payments'])
            ->get();

        $totalRevenue  = $invoices->sum('grand_total');
        $totalDiscount = $invoices->sum('discount_total');
        $totalTax      = $invoices->sum('tax_total');
        $invoiceCount  = $invoices->count();

        return response()->json([
            'grossSales'   => (string) round((float)$totalRevenue, 4),
            'discounts'    => (string) round((float)$totalDiscount, 4),
            'taxCollected' => (string) round((float)$totalTax, 4),
            'netSales'     => (string) round(max(0, (float)$totalRevenue - (float)$totalDiscount), 4),
            'invoiceCount' => $invoiceCount,
            'from'         => $from,
            'to'           => $to,
        ]);
    }

    public function paymentMethods(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        [$from, $to] = $this->dateRange($request);

        $branchIds = Branch::where('tenant_id', $tenantId)
            ->when($request->branchId, fn($q,$b) => $q->where('id', $b))
            ->pluck('id');

        $invoices = Invoice::whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->where('invoice_type', 'sale')
            ->whereBetween('created_at', [$from, $to])
            ->with('payments')
            ->get();

        $breakdown = [];
        foreach ($invoices as $inv) {
            foreach ($inv->payments as $pay) {
                $m = $pay->method;
                if (!isset($breakdown[$m])) {
                    $breakdown[$m] = ['method' => $m, 'count' => 0, 'total' => 0.0];
                }
                $breakdown[$m]['count']++;
                $breakdown[$m]['total'] += (float)$pay->amount;
            }
        }

        $result = array_values(array_map(function ($row) {
            $row['total'] = (string) round($row['total'], 4);
            return $row;
        }, $breakdown));

        return response()->json($result);
    }

    public function stockValuation(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        $stockData = DB::table('stock_levels as sl')
            ->join('warehouses as w', 'w.id', '=', 'sl.warehouse_id')
            ->join('products as p', 'p.id', '=', 'sl.product_id')
            ->whereIn('w.branch_id', $branchIds)
            ->whereNull('p.deleted_at')
            ->select(
                'p.id as product_id',
                'p.name as name',
                'p.sku',
                'sl.quantity_on_hand',
                'p.cost_price',
                DB::raw('sl.quantity_on_hand * p.cost_price as value')
            )
            ->get();

        return response()->json([
            'lines' => $stockData,
            'total' => $stockData->sum('value'),
        ]);
    }

    public function topProducts(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        [$from, $to] = $this->dateRange($request);
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        $results = DB::table('invoice_lines as il')
            ->join('invoices as i', 'i.id', '=', 'il.invoice_id')
            ->join('products as p', 'p.id', '=', 'il.product_id')
            ->whereIn('i.branch_id', $branchIds)
            ->where('i.status', 'completed')
            ->whereBetween('i.created_at', [$from, $to])
            ->select(
                'p.id as product_id',
                'p.name as name',
                'p.sku',
                DB::raw('SUM(il.quantity) as quantity_sold'),
                DB::raw('SUM(il.line_total) as revenue')
            )
            ->groupBy('p.id', 'p.name', 'p.sku')
            ->orderByDesc('revenue')
            ->limit(20)
            ->get();

        return response()->json($results);
    }

    public function lowStock(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        $items = DB::table('stock_levels as sl')
            ->join('warehouses as w', 'w.id', '=', 'sl.warehouse_id')
            ->join('products as p', 'p.id', '=', 'sl.product_id')
            ->whereIn('w.branch_id', $branchIds)
            ->whereNull('p.deleted_at')
            ->whereRaw('sl.quantity_on_hand <= p.reorder_level')
            ->select(
                'p.id as product_id',
                'p.name as name',
                'p.sku',
                'p.reorder_level',
                'sl.warehouse_id',
                'w.name as warehouse_name',
                'sl.quantity_on_hand'
            )
            ->orderBy('sl.quantity_on_hand')
            ->get();

        return response()->json($items);
    }

    public function dashboardStats(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $branchIds = Branch::where('tenant_id', $tenantId)->pluck('id');

        $totalProducts = Product::where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->count();

        $lowStockCount = DB::table('stock_levels as sl')
            ->join('warehouses as w', 'w.id', '=', 'sl.warehouse_id')
            ->join('products as p', 'p.id', '=', 'sl.product_id')
            ->whereIn('w.branch_id', $branchIds)
            ->whereNull('p.deleted_at')
            ->whereRaw('sl.quantity_on_hand <= p.reorder_level')
            ->count();

        return response()->json([
            'totalProducts' => $totalProducts,
            'lowStockCount' => $lowStockCount,
        ]);
    }

    public function dailyClosingSummary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $branchId = $request->branchId;
        $date     = $request->date ?? now()->toDateString();

        $branchIds = Branch::where('tenant_id', $tenantId)
            ->when($branchId, fn($q,$b) => $q->where('id', $b))
            ->pluck('id');

        $invoices = Invoice::whereIn('branch_id', $branchIds)
            ->where('status', 'completed')
            ->whereDate('created_at', $date)
            ->with('payments')
            ->get();

        $expenses = Expense::whereIn('branch_id', $branchIds)
            ->whereDate('occurred_at', $date)
            ->whereNull('voided_at')
            ->get();

        $income = IncomeEntry::whereIn('branch_id', $branchIds)
            ->whereDate('occurred_at', $date)
            ->whereNull('voided_at')
            ->get();

        $cashPayments  = $invoices->flatMap->payments->where('method', 'cash')->sum('amount');
        $totalExpenses = $expenses->sum('amount');
        $totalIncome   = $income->sum('amount');
        $expectedCash  = (float)$cashPayments - (float)$totalExpenses + (float)$totalIncome;

        return response()->json([
            'date'          => $date,
            'totalRevenue'  => $invoices->sum('grand_total'),
            'invoiceCount'  => $invoices->count(),
            'cashPayments'  => $cashPayments,
            'totalExpenses' => $totalExpenses,
            'totalIncome'   => $totalIncome,
            'expectedCash'  => $expectedCash,
        ]);
    }
}
