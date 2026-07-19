<?php

namespace App\Http\Controllers\WhatsApp;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppSettings;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WhatsAppSettingsController extends Controller
{
    public function show(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $settings = WhatsAppSettings::where('tenant_id', $tenantId)->first();
        $defaults  = WhatsAppSettings::defaultTemplates();

        if (!$settings) {
            return response()->json([
                'tenantId'               => $tenantId,
                'provider'               => 'ultramsg',
                'instanceId'             => null,
                'phoneNumberId'          => null,
                'fromNumber'             => null,
                'isEnabled'              => true,
                'notifyInvoice'          => true,
                'notifyAppointment'      => true,
                'notifyInstallmentDue'   => true,
                'notifyInstallmentPaid'  => false,
                'reminderDaysBefore'     => 3,
                'templateInvoice'        => $defaults['template_invoice'],
                'templateAppointment'    => $defaults['template_appointment'],
                'templateInstallmentDue' => $defaults['template_installment_due'],
                'templateInstallmentPaid'=> $defaults['template_installment_paid'],
                'hasApiToken'            => false,
            ]);
        }

        return response()->json([
            'tenantId'               => $settings->tenant_id,
            'provider'               => $settings->provider,
            'instanceId'             => $settings->instance_id,
            'phoneNumberId'          => $settings->phone_number_id,
            'fromNumber'             => $settings->from_number,
            'isEnabled'              => $settings->is_enabled,
            'notifyInvoice'          => $settings->notify_invoice,
            'notifyAppointment'      => $settings->notify_appointment,
            'notifyInstallmentDue'   => $settings->notify_installment_due,
            'notifyInstallmentPaid'  => $settings->notify_installment_paid,
            'reminderDaysBefore'     => $settings->reminder_days_before,
            'templateInvoice'        => $settings->template_invoice ?? $defaults['template_invoice'],
            'templateAppointment'    => $settings->template_appointment ?? $defaults['template_appointment'],
            'templateInstallmentDue' => $settings->template_installment_due ?? $defaults['template_installment_due'],
            'templateInstallmentPaid'=> $settings->template_installment_paid ?? $defaults['template_installment_paid'],
            'hasApiToken'            => !empty($settings->api_token),
        ]);
    }

    public function update(Request $request)
    {
        $request->validate([
            'provider'              => 'nullable|in:ultramsg,meta,twilio',
            'instanceId'            => 'nullable|string|max:200',
            'phoneNumberId'         => 'nullable|string|max:200',
            'fromNumber'            => 'nullable|string|max:30',
            'apiToken'              => 'nullable|string|max:500',
            'isEnabled'             => 'nullable|boolean',
            'notifyInvoice'         => 'nullable|boolean',
            'notifyAppointment'     => 'nullable|boolean',
            'notifyInstallmentDue'  => 'nullable|boolean',
            'notifyInstallmentPaid' => 'nullable|boolean',
            'reminderDaysBefore'    => 'nullable|integer|min:1|max:30',
            'templateInvoice'       => 'nullable|string',
            'templateAppointment'   => 'nullable|string',
            'templateInstallmentDue'=> 'nullable|string',
            'templateInstallmentPaid'=> 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        $data = array_filter([
            'provider'               => $request->provider,
            'instance_id'            => $request->instanceId,
            'phone_number_id'        => $request->phoneNumberId,
            'from_number'            => $request->fromNumber,
            'is_enabled'             => $request->has('isEnabled') ? (bool)$request->isEnabled : null,
            'notify_invoice'         => $request->has('notifyInvoice') ? (bool)$request->notifyInvoice : null,
            'notify_appointment'     => $request->has('notifyAppointment') ? (bool)$request->notifyAppointment : null,
            'notify_installment_due' => $request->has('notifyInstallmentDue') ? (bool)$request->notifyInstallmentDue : null,
            'notify_installment_paid'=> $request->has('notifyInstallmentPaid') ? (bool)$request->notifyInstallmentPaid : null,
            'reminder_days_before'   => $request->reminderDaysBefore,
            'template_invoice'       => $request->templateInvoice,
            'template_appointment'   => $request->templateAppointment,
            'template_installment_due' => $request->templateInstallmentDue,
            'template_installment_paid'=> $request->templateInstallmentPaid,
        ], fn($v) => $v !== null);

        // Only update api_token if explicitly provided (non-empty string)
        if ($request->filled('apiToken')) {
            $data['api_token'] = $request->apiToken;
        }

        $settings = WhatsAppSettings::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['id' => (string) Str::uuid(), 'tenant_id' => $tenantId]
        );

        $settings->update($data);

        return $this->show($request);
    }

    public function sendTest(Request $request)
    {
        $request->validate([
            'phone' => 'required|string|max:20',
        ]);

        $tenantId = $request->user()->tenant_id;
        $result   = app(WhatsAppService::class)->sendTest($tenantId, $request->phone);

        return response()->json($result, $result['ok'] ? 200 : 422);
    }

    public function logs(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $logs = \App\Models\WhatsAppLog::where('tenant_id', $tenantId)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get(['id', 'to_number', 'status', 'reference_type', 'reference_id', 'error_message', 'created_at']);

        return response()->json($logs);
    }
}
