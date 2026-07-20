<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabCommissionPayment extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'lab_commission_payments';

    protected $fillable = [
        'id', 'tenant_id', 'doctor_id', 'amount', 'method', 'notes', 'paid_at', 'created_by',
    ];

    public function doctor(): BelongsTo { return $this->belongsTo(Doctor::class); }
}
