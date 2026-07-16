<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderLine extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'purchase_order_lines';
    public $timestamps = false;

    protected $fillable = [
        'id','purchase_order_id','product_id','quantity_ordered','quantity_received','unit_cost',
    ];

    public function purchaseOrder(): BelongsTo { return $this->belongsTo(PurchaseOrder::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
