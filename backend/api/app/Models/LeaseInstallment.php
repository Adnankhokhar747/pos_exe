<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaseInstallment extends Model
{
    protected $table = 'lease_installments';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'agreement_id', 'installment_number',
        'due_date', 'amount', 'paid_amount', 'paid_date',
        'payment_method', 'reference_number', 'status', 'notes',
    ];

    protected $casts = [
        'due_date'    => 'date',
        'paid_date'   => 'date',
        'amount'      => 'decimal:2',
        'paid_amount' => 'decimal:2',
    ];

    public function agreement()
    {
        return $this->belongsTo(LeaseAgreement::class);
    }
}
