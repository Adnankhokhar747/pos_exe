<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SerialNumber extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'serial_numbers';
    public $timestamps = false;

    protected $fillable = [
        'id', 'product_id', 'warehouse_id', 'serial_no',
        'status', 'invoice_line_id', 'created_at',
    ];

    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function warehouse(): BelongsTo { return $this->belongsTo(Warehouse::class); }
}
