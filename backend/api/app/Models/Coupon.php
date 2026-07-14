<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'coupons';
    public $timestamps = false;

    protected $fillable = [
        'id', 'tenant_id', 'code', 'discount_type', 'discount_value',
        'expiry_date', 'usage_limit', 'usage_count', 'is_active', 'created_at',
    ];

    protected $casts = [
        'is_active'   => 'boolean',
        'usage_count' => 'integer',
        'usage_limit' => 'integer',
    ];
}
