<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class GiftCardTransaction extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'gift_card_transactions';
    public $timestamps = false;

    protected $fillable = [
        'id', 'gift_card_id', 'type', 'amount', 'balance_after',
        'reference_table', 'reference_id', 'occurred_at',
    ];
}
