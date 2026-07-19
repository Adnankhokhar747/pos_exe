<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsAppLog extends Model
{
    protected $table      = 'whatsapp_logs';
    protected $keyType    = 'string';
    public $incrementing  = false;
    public $timestamps    = false;

    protected $fillable = [
        'id', 'tenant_id', 'to_number', 'message',
        'status', 'error_message', 'reference_type', 'reference_id',
        'created_at',
    ];
}
