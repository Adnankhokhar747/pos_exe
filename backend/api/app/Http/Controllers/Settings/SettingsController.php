<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ReceiptSettings;
use App\Models\Printer;
use App\Exceptions\NotFoundException;

class SettingsController extends Controller
{
    public function getReceiptSettings(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        return ReceiptSettings::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['id' => (string) \Illuminate\Support\Str::uuid(), 'paper_width_mm' => 80]
        );
    }

    public function updateReceiptSettings(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $settings = ReceiptSettings::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['id' => (string) \Illuminate\Support\Str::uuid(), 'paper_width_mm' => 80]
        );

        $settings->update($request->only(['header_text','footer_text','paper_width_mm']));
        return $settings;
    }

    public function getPrinters(Request $request)
    {
        return Printer::where('tenant_id', $request->user()->tenant_id)
            ->when($request->branchId, fn($q,$b) => $q->where('branch_id',$b))
            ->orderBy('name')
            ->get();
    }

    public function createPrinter(Request $request)
    {
        $request->validate([
            'branchId'          => 'required|uuid',
            'name'              => 'required|string',
            'type'              => 'required|string',
            'systemPrinterName' => 'required|string',
        ]);

        return Printer::create([
            'id'                  => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id'           => $request->user()->tenant_id,
            'branch_id'           => $request->branchId,
            'name'                => $request->name,
            'type'                => $request->type,
            'system_printer_name' => $request->systemPrinterName,
            'is_default_receipt'  => $request->isDefaultReceipt ?? false,
            'is_default_invoice'  => $request->isDefaultInvoice ?? false,
        ]);
    }

    public function updatePrinter(Request $request, string $id)
    {
        $printer = Printer::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$printer) throw new NotFoundException("Printer {$id} not found.");
        $printer->update(array_filter($request->only([
            'name','type','system_printer_name','is_default_receipt','is_default_invoice'
        ]), fn($v) => $v !== null));
        return $printer;
    }

    public function deletePrinter(Request $request, string $id)
    {
        $printer = Printer::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$printer) throw new NotFoundException("Printer {$id} not found.");
        $printer->delete();
        return response()->json(['message' => 'Printer deleted.']);
    }
}
