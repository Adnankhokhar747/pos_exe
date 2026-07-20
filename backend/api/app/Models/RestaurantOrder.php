<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestaurantOrder extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'restaurant_orders';

    protected $fillable = [
        'id', 'tenant_id', 'session_id', 'status', 'notes', 'created_by',
    ];

    public function session(): BelongsTo { return $this->belongsTo(RestaurantTableSession::class, 'session_id'); }
    public function items(): HasMany { return $this->hasMany(RestaurantOrderItem::class, 'order_id'); }
    public function tickets(): HasMany { return $this->hasMany(RestaurantKdsTicket::class, 'order_id'); }
}
