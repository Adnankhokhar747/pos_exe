<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientLedgerEntry extends Model
{
    protected $table = 'patient_ledger_entries';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id','tenant_id','patient_id','appointment_id','entry_type',
        'amount','balance_after','description','created_by','occurred_at',
    ];

    protected $casts = ['occurred_at' => 'datetime'];

    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }
    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }
}
