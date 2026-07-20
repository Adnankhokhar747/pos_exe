<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RestaurantTableSession extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'restaurant_table_sessions';

    protected $fillable = [
        'id', 'tenant_id', 'table_id', 'opened_by', 'opened_at',
        'closed_at', 'covers', 'waiter_name', 'invoice_id', 'notes',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'covers'    => 'integer',
    ];

    public function table(): BelongsTo { return $this->belongsTo(RestaurantTable::class, 'table_id'); }
    public function openedByUser(): BelongsTo { return $this->belongsTo(User::class, 'opened_by'); }
    public function order(): HasOne { return $this->hasOne(RestaurantOrder::class, 'session_id'); }
}
