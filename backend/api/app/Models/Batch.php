<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Batch extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'batches';
    public $timestamps = false;

    protected $fillable = [
        'id', 'product_id', 'warehouse_id', 'batch_no',
        'expiry_date', 'quantity_on_hand', 'cost_price', 'created_at',
    ];

    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function warehouse(): BelongsTo { return $this->belongsTo(Warehouse::class); }
}
