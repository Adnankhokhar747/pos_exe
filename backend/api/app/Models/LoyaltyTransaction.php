<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyTransaction extends Model
{
    protected $table = 'loyalty_transactions';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'customer_id', 'type', 'points', 'balance_after',
        'reference_table', 'reference_id', 'occurred_at',
    ];
}
