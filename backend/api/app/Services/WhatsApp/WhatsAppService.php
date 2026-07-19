<?php

namespace App\Services\WhatsApp;

use App\Models\WhatsAppSettings;
use App\Models\WhatsAppLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class WhatsAppService
{
    /**
     * Send an invoice notification to a customer.
     */
    public function sendInvoice(string $tenantId, array $data): void
    {
        $settings = $this->getSettings($tenantId);
        if (!$settings || !$settings->is_enabled || !$settings->notify_invoice) return;

        $phone = $this->normalizePhone($data['customerPhone'] ?? '');
        if (!$phone) return;

        $message = $this->render($settings->template_invoice ?? WhatsAppSettings::defaultTemplates()['template_invoice'], [
            'customer_name'  => $data['customerName']  ?? 'Valued Customer',
            'invoice_number' => $data['invoiceNumber'] ?? '',
            'amount'         => $this->formatAmount($data['grandTotal'] ?? 0),
            'business_name'  => $data['businessName']  ?? '',
        ]);

        $this->send($settings, $tenantId, $phone, $message, 'invoice', $data['invoiceId'] ?? null);
    }

    /**
     * Send an appointment confirmation to a patient.
     */
    public function sendAppointment(string $tenantId, array $data): void
    {
        $settings = $this->getSettings($tenantId);
        if (!$settings || !$settings->is_enabled || !$settings->notify_appointment) return;

        $phone = $this->normalizePhone($data['patientPhone'] ?? '');
        if (!$phone) return;

        $message = $this->render($settings->template_appointment ?? WhatsAppSettings::defaultTemplates()['template_appointment'], [
            'patient_name'   => $data['patientName']   ?? 'Patient',
            'doctor_name'    => $data['doctorName']    ?? '',
            'token_number'   => $data['tokenNumber']   ?? '',
            'date'           => $data['date']           ?? '',
            'business_name'  => $data['businessName']  ?? '',
        ]);

        $this->send($settings, $tenantId, $phone, $message, 'appointment', $data['appointmentId'] ?? null);
    }

    /**
     * Send a lease installment due reminder.
     */
    public function sendInstallmentDue(string $tenantId, array $data): void
    {
        $settings = $this->getSettings($tenantId);
        if (!$settings || !$settings->is_enabled || !$settings->notify_installment_due) return;

        $phone = $this->normalizePhone($data['customerPhone'] ?? '');
        if (!$phone) return;

        $message = $this->render($settings->template_installment_due ?? WhatsAppSettings::defaultTemplates()['template_installment_due'], [
            'customer_name'     => $data['customerName']      ?? 'Customer',
            'amount'            => $this->formatAmount($data['amount'] ?? 0),
            'due_date'          => $data['dueDate']            ?? '',
            'remaining_balance' => $this->formatAmount($data['remainingBalance'] ?? 0),
            'business_name'     => $data['businessName']       ?? '',
        ]);

        $this->send($settings, $tenantId, $phone, $message, 'installment', $data['installmentId'] ?? null);
    }

    /**
     * Send a lease installment paid confirmation.
     */
    public function sendInstallmentPaid(string $tenantId, array $data): void
    {
        $settings = $this->getSettings($tenantId);
        if (!$settings || !$settings->is_enabled || !$settings->notify_installment_paid) return;

        $phone = $this->normalizePhone($data['customerPhone'] ?? '');
        if (!$phone) return;

        $message = $this->render($settings->template_installment_paid ?? WhatsAppSettings::defaultTemplates()['template_installment_paid'], [
            'customer_name'     => $data['customerName']      ?? 'Customer',
            'amount'            => $this->formatAmount($data['paidAmount'] ?? 0),
            'remaining_balance' => $this->formatAmount($data['remainingBalance'] ?? 0),
            'business_name'     => $data['businessName']       ?? '',
        ]);

        $this->send($settings, $tenantId, $phone, $message, 'installment', $data['installmentId'] ?? null);
    }

    /**
     * Send a test message to verify credentials.
     */
    public function sendTest(string $tenantId, string $phone): array
    {
        $settings = $this->getSettings($tenantId);
        if (!$settings) return ['ok' => false, 'error' => 'No WhatsApp settings configured.'];

        $normalized = $this->normalizePhone($phone);
        if (!$normalized) return ['ok' => false, 'error' => 'Invalid phone number.'];

        $businessName = $this->getBusinessName($tenantId);
        $message = "✅ WhatsApp notifications are working correctly!\n- {$businessName}";

        return $this->send($settings, $tenantId, $normalized, $message, null, null, true);
    }

    // ─── Core send ────────────────────────────────────────────────────────────

    private function send(
        WhatsAppSettings $settings,
        string $tenantId,
        string $phone,
        string $message,
        ?string $refType,
        ?string $refId,
        bool $returnResult = false
    ): array {
        try {
            match ($settings->provider) {
                'ultramsg' => $this->sendViaUltraMsg($settings, $phone, $message),
                'meta'     => $this->sendViaMeta($settings, $phone, $message),
                'twilio'   => $this->sendViaTwilio($settings, $phone, $message),
            };

            $this->log($tenantId, $phone, $message, 'sent', null, $refType, $refId);
            return ['ok' => true];
        } catch (\Throwable $e) {
            Log::warning("WhatsApp send failed: {$e->getMessage()}", ['tenant' => $tenantId, 'phone' => $phone]);
            $this->log($tenantId, $phone, $message, 'failed', $e->getMessage(), $refType, $refId);

            if ($returnResult) return ['ok' => false, 'error' => $e->getMessage()];
            return ['ok' => false];
        }
    }

    // ─── Providers ────────────────────────────────────────────────────────────

    private function sendViaUltraMsg(WhatsAppSettings $s, string $phone, string $message): void
    {
        if (!$s->instance_id || !$s->api_token) {
            throw new \RuntimeException('UltraMsg instance ID and token are required.');
        }

        $response = Http::timeout(15)
            ->asForm()
            ->post("https://api.ultramsg.com/{$s->instance_id}/messages/chat", [
                'token' => $s->api_token,
                'to'    => $phone,
                'body'  => $message,
            ]);

        if (!$response->successful()) {
            throw new \RuntimeException("UltraMsg error {$response->status()}: {$response->body()}");
        }

        $json = $response->json();
        if (isset($json['error'])) {
            throw new \RuntimeException("UltraMsg error: {$json['error']}");
        }
    }

    private function sendViaMeta(WhatsAppSettings $s, string $phone, string $message): void
    {
        if (!$s->phone_number_id || !$s->api_token) {
            throw new \RuntimeException('Meta phone number ID and access token are required.');
        }

        $response = Http::timeout(15)
            ->withToken($s->api_token)
            ->post("https://graph.facebook.com/v19.0/{$s->phone_number_id}/messages", [
                'messaging_product' => 'whatsapp',
                'to'                => $phone,
                'type'              => 'text',
                'text'              => ['body' => $message],
            ]);

        if (!$response->successful()) {
            $err = $response->json('error.message') ?? $response->body();
            throw new \RuntimeException("Meta API error {$response->status()}: {$err}");
        }
    }

    private function sendViaTwilio(WhatsAppSettings $s, string $phone, string $message): void
    {
        if (!$s->instance_id || !$s->api_token || !$s->from_number) {
            throw new \RuntimeException('Twilio account SID, auth token, and from number are required.');
        }

        $response = Http::timeout(15)
            ->withBasicAuth($s->instance_id, $s->api_token)
            ->asForm()
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$s->instance_id}/Messages.json", [
                'From' => "whatsapp:{$s->from_number}",
                'To'   => "whatsapp:+{$phone}",
                'Body' => $message,
            ]);

        if (!$response->successful()) {
            $err = $response->json('message') ?? $response->body();
            throw new \RuntimeException("Twilio error {$response->status()}: {$err}");
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function getSettings(string $tenantId): ?WhatsAppSettings
    {
        // Check if whatsapp module is enabled for this tenant
        $enabled = DB::table('tenant_modules')
            ->join('module_catalog', 'module_catalog.id', '=', 'tenant_modules.module_id')
            ->where('tenant_modules.tenant_id', $tenantId)
            ->where('module_catalog.code', 'whatsapp')
            ->where('tenant_modules.enabled', true)
            ->exists();

        if (!$enabled) return null;

        return WhatsAppSettings::where('tenant_id', $tenantId)->first();
    }

    private function render(string $template, array $vars): string
    {
        foreach ($vars as $key => $value) {
            $template = str_replace("{{$key}}", (string)$value, $template);
        }
        return $template;
    }

    private function normalizePhone(?string $phone): string
    {
        if (!$phone) return '';
        // Strip everything except digits
        $digits = preg_replace('/\D/', '', $phone);
        if (strlen($digits) < 7) return '';
        return $digits;
    }

    private function formatAmount(float|int|string $amount): string
    {
        return number_format((float)$amount, 2);
    }

    public function getBusinessName(string $tenantId): string
    {
        return DB::table('tenants')->where('id', $tenantId)->value('name') ?? '';
    }

    private function log(
        string $tenantId,
        string $phone,
        string $message,
        string $status,
        ?string $error,
        ?string $refType,
        ?string $refId
    ): void {
        WhatsAppLog::create([
            'id'             => (string) Str::uuid(),
            'tenant_id'      => $tenantId,
            'to_number'      => $phone,
            'message'        => $message,
            'status'         => $status,
            'error_message'  => $error,
            'reference_type' => $refType,
            'reference_id'   => $refId,
            'created_at'     => now(),
        ]);
    }
}
