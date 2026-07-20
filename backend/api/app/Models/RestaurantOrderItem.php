<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantOrderItem extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'restaurant_order_items';

    protected $fillable = [
        'id', 'order_id', 'product_id', 'product_name', 'quantity',
        'unit_price', 'subtotal', 'notes', 'kds_ticket_id', 'kds_status',
    ];

    protected $casts = [
        'quantity'   => 'float',
        'unit_price' => 'float',
        'subtotal'   => 'float',
    ];

    public function order(): BelongsTo { return $this->belongsTo(RestaurantOrder::class, 'order_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function kdsTicket(): BelongsTo { return $this->belongsTo(RestaurantKdsTicket::class, 'kds_ticket_id'); }
}
