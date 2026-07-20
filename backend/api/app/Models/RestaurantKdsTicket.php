<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestaurantKdsTicket extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'restaurant_kds_tickets';

    protected $fillable = [
        'id', 'tenant_id', 'order_id', 'status',
        'sent_at', 'started_at', 'completed_at',
    ];

    protected $casts = [
        'sent_at'      => 'datetime',
        'started_at'   => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function order(): BelongsTo { return $this->belongsTo(RestaurantOrder::class, 'order_id'); }
    public function items(): HasMany { return $this->hasMany(RestaurantOrderItem::class, 'kds_ticket_id'); }
}
