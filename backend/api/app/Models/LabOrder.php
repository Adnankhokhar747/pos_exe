<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\HasUuidPrimaryKey;

class LabOrder extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'lab_orders';

    protected $fillable = [
        'id', 'tenant_id', 'order_number', 'patient_id', 'appointment_id',
        'doctor_id', 'ordered_by', 'status', 'priority', 'total_amount', 'notes',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
    ];

    public function tenant()      { return $this->belongsTo(Tenant::class); }
    public function patient()     { return $this->belongsTo(Patient::class, 'patient_id'); }
    public function doctor()      { return $this->belongsTo(Doctor::class, 'doctor_id'); }
    public function appointment() { return $this->belongsTo(Appointment::class, 'appointment_id'); }
    public function items()       { return $this->hasMany(LabOrderItem::class, 'order_id'); }
}
