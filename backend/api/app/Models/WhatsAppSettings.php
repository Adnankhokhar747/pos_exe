<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsAppSettings extends Model
{
    protected $table = 'whatsapp_settings';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $hidden = ['api_token'];

    protected $fillable = [
        'id', 'tenant_id', 'provider',
        'api_token', 'instance_id', 'phone_number_id', 'from_number',
        'is_enabled',
        'notify_invoice', 'notify_appointment',
        'notify_installment_due', 'notify_installment_paid',
        'reminder_days_before',
        'template_invoice', 'template_appointment',
        'template_installment_due', 'template_installment_paid',
    ];

    protected $casts = [
        'is_enabled'               => 'boolean',
        'notify_invoice'           => 'boolean',
        'notify_appointment'       => 'boolean',
        'notify_installment_due'   => 'boolean',
        'notify_installment_paid'  => 'boolean',
        'reminder_days_before'     => 'integer',
    ];

    // Default templates exposed when no row exists yet
    public static function defaultTemplates(): array
    {
        return [
            'template_invoice'          => "Dear {customer_name}, your invoice #{invoice_number} for {amount} has been created. Thank you for your business!\n- {business_name}",
            'template_appointment'      => "Dear {patient_name}, your appointment with Dr. {doctor_name} is confirmed.\nToken: #{token_number} | Date: {date}\n- {business_name}",
            'template_installment_due'  => "Dear {customer_name}, a payment of {amount} is due on {due_date}.\nRemaining balance: {remaining_balance}.\nPlease make the payment on time.\n- {business_name}",
            'template_installment_paid' => "Dear {customer_name}, we received your payment of {amount}. Thank you!\nRemaining balance: {remaining_balance}.\n- {business_name}",
        ];
    }
}
