<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoodsReceiptLine extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'goods_receipt_lines';
    public $timestamps = false;

    protected $fillable = [
        'id','goods_receipt_id','product_id','quantity_received','unit_cost',
        'batch_no','expiry_date','serial_numbers',
    ];

    protected $casts = ['serial_numbers' => 'array'];

    public function goodsReceipt(): BelongsTo { return $this->belongsTo(GoodsReceipt::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
