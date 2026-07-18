<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeasePayment extends Model
{
    protected $table = 'lease_payments';

    public $incrementing = false;
    protected $keyType   = 'string';

    protected $fillable = [
        'id', 'tenant_id', 'lease_id', 'amount',
        'due_date', 'paid_date', 'period_start', 'period_end',
        'payment_method', 'status', 'reference_number', 'notes',
    ];

    protected $casts = [
        'amount'      => 'decimal:4',
        'due_date'    => 'date',
        'paid_date'   => 'date',
        'period_start'=> 'date',
        'period_end'  => 'date',
    ];

    public function lease()
    {
        return $this->belongsTo(LeaseAgreement::class, 'lease_id');
    }
}
