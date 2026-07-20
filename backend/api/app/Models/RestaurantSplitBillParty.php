<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantSplitBillParty extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'restaurant_split_bill_parties';

    protected $fillable = [
        'id', 'split_bill_id', 'party_number', 'amount', 'is_paid', 'invoice_id', 'paid_at',
    ];

    protected $casts = [
        'amount'  => 'float',
        'is_paid' => 'boolean',
        'paid_at' => 'datetime',
    ];

    public function splitBill(): BelongsTo { return $this->belongsTo(RestaurantSplitBill::class, 'split_bill_id'); }
}
