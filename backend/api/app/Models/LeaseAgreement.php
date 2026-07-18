<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaseAgreement extends Model
{
    protected $table = 'lease_agreements';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'title', 'category', 'customer_id',
        'total_amount', 'down_payment', 'financed_amount',
        'installment_count', 'installment_amount', 'frequency',
        'start_date', 'first_installment_date', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'start_date'             => 'date',
        'first_installment_date' => 'date',
        'total_amount'           => 'decimal:2',
        'down_payment'           => 'decimal:2',
        'financed_amount'        => 'decimal:2',
        'installment_amount'     => 'decimal:2',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function installments()
    {
        return $this->hasMany(LeaseInstallment::class, 'agreement_id')->orderBy('installment_number');
    }
}
