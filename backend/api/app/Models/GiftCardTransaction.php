<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GiftCardTransaction extends Model
{
    protected $table = 'gift_card_transactions';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'gift_card_id', 'type', 'amount', 'balance_after',
        'reference_table', 'reference_id', 'occurred_at',
    ];
}
