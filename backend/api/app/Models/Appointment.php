<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Appointment extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'appointments';

    protected $fillable = [
        'id','tenant_id','doctor_id','patient_id','appointment_type','status',
        'appointment_date','token_number','booked_at','arrived_at','completed_at',
        'cancelled_at','cancel_reason','notes','created_by',
    ];

    protected $casts = [
        'appointment_date' => 'date',
        'booked_at'    => 'datetime',
        'arrived_at'   => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function doctor(): BelongsTo { return $this->belongsTo(Doctor::class); }
    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }
    public function bill(): HasOne { return $this->hasOne(AppointmentBill::class); }
    public function ledgerEntries(): HasMany { return $this->hasMany(PatientLedgerEntry::class); }
}
