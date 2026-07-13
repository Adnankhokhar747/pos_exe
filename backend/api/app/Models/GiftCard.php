<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GiftCard extends Model
{
    protected $table = 'gift_cards';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'tenant_id', 'code', 'initial_balance', 'current_balance',
        'expiry_date', 'is_active', 'issued_at',
    ];

    protected $casts = ['is_active' => 'boolean'];

    public function transactions(): HasMany
    {
        return $this->hasMany(GiftCardTransaction::class);
    }
}
