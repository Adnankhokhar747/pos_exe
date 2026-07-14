<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AppointmentBill extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'appointment_bills';
    public $timestamps = false;

    protected $fillable = [
        'id','tenant_id','appointment_id','is_draft','consultation_fee','medicine_total',
        'total_due','advance_applied','total_collected','advance_credited','patient_balance',
        'notes','finalized_by','finalized_at','created_at',
    ];

    protected $casts = [
        'is_draft'     => 'boolean',
        'finalized_at' => 'datetime',
        'created_at'   => 'datetime',
    ];

    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }
    public function lines(): HasMany { return $this->hasMany(AppointmentBillLine::class, 'bill_id'); }
    public function payments(): HasMany { return $this->hasMany(AppointmentBillPayment::class, 'bill_id'); }
}
