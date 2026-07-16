<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class LoyaltyTransaction extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'loyalty_transactions';
    public $timestamps = false;

    protected $fillable = [
        'id', 'customer_id', 'type', 'points', 'balance_after',
        'reference_table', 'reference_id', 'occurred_at',
    ];
}
