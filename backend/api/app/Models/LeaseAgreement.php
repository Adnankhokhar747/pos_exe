<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaseAgreement extends Model
{
    protected $table = 'lease_agreements';

    public $incrementing = false;
    protected $keyType   = 'string';

    protected $fillable = [
        'id', 'tenant_id', 'property_id', 'customer_id',
        'start_date', 'end_date', 'rent_amount', 'rent_frequency',
        'deposit_amount', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'rent_amount'    => 'decimal:4',
        'deposit_amount' => 'decimal:4',
        'start_date'     => 'date',
        'end_date'       => 'date',
    ];

    public function property()
    {
        return $this->belongsTo(LeaseProperty::class, 'property_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function payments()
    {
        return $this->hasMany(LeasePayment::class, 'lease_id');
    }
}
