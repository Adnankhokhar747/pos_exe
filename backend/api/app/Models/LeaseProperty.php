<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaseProperty extends Model
{
    protected $table = 'lease_properties';

    public $incrementing = false;
    protected $keyType   = 'string';

    protected $fillable = [
        'id', 'tenant_id', 'name', 'type', 'address',
        'description', 'base_rent', 'is_active',
    ];

    protected $casts = [
        'base_rent' => 'decimal:4',
        'is_active'  => 'boolean',
    ];

    public function agreements()
    {
        return $this->hasMany(LeaseAgreement::class, 'property_id');
    }
}
