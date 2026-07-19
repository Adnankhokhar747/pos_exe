<?php

namespace App\Console\Commands;

use App\Models\LeaseInstallment;
use App\Models\WhatsAppLog;
use App\Services\WhatsApp\WhatsAppService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SendWhatsAppRemindersCommand extends Command
{
    protected $signature   = 'whatsapp:send-reminders {--tenant= : Run for a specific tenant ID only}';
    protected $description = 'Send WhatsApp reminders for lease installments due soon.';

    public function __construct(private WhatsAppService $whatsapp)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $specificTenant = $this->option('tenant');

        // Find all tenants that have the whatsapp module enabled
        $tenantIds = DB::table('tenant_modules')
            ->join('module_catalog', 'module_catalog.id', '=', 'tenant_modules.module_id')
            ->where('module_catalog.code', 'whatsapp')
            ->where('tenant_modules.enabled', true)
            ->when($specificTenant, fn($q) => $q->where('tenant_modules.tenant_id', $specificTenant))
            ->pluck('tenant_modules.tenant_id');

        $totalSent = 0;

        foreach ($tenantIds as $tenantId) {
            $sent = $this->processForTenant($tenantId);
            $totalSent += $sent;
            $this->info("Tenant {$tenantId}: {$sent} reminder(s) sent.");
        }

        $this->info("Done. Total sent: {$totalSent}");
        return 0;
    }

    private function processForTenant(string $tenantId): int
    {
        $settings = \App\Models\WhatsAppSettings::where('tenant_id', $tenantId)->first();

        if (!$settings || !$settings->is_enabled || !$settings->notify_installment_due) {
            return 0;
        }

        $reminderDays = $settings->reminder_days_before ?? 3;
        $targetDate   = Carbon::today()->addDays($reminderDays)->toDateString();

        // Find pending/overdue installments due on the target date for this tenant
        $installments = LeaseInstallment::where('tenant_id', $tenantId)
            ->whereIn('status', ['pending'])
            ->where('due_date', $targetDate)
            ->with(['agreement.customer'])
            ->get();

        $businessName = $this->whatsapp->getBusinessName($tenantId);
        $sent = 0;

        foreach ($installments as $inst) {
            $customer = $inst->agreement?->customer;
            if (!$customer?->phone) continue;

            // Avoid duplicate reminders sent today for this installment
            $alreadySent = WhatsAppLog::where('tenant_id', $tenantId)
                ->where('reference_type', 'installment')
                ->where('reference_id', $inst->id)
                ->where('status', 'sent')
                ->whereDate('created_at', today())
                ->exists();

            if ($alreadySent) continue;

            // Calculate remaining balance
            $totalPending = LeaseInstallment::where('agreement_id', $inst->agreement_id)
                ->whereIn('status', ['pending', 'partial', 'overdue'])
                ->sum('amount');

            $this->whatsapp->sendInstallmentDue($tenantId, [
                'customerName'     => $customer->name,
                'customerPhone'    => $customer->phone,
                'amount'           => $inst->amount,
                'dueDate'          => $inst->due_date?->toDateString() ?? $targetDate,
                'remainingBalance' => $totalPending,
                'installmentId'    => $inst->id,
                'businessName'     => $businessName,
            ]);

            $sent++;
        }

        return $sent;
    }
}
