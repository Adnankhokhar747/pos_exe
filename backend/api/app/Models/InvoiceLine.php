<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceLine extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'invoice_lines';
    public $timestamps = false;

    protected $fillable = [
        'id','invoice_id','product_id','quantity','unit_price',
        'discount_value','tax_amount','line_total','original_invoice_line_id',
    ];

    public function invoice(): BelongsTo { return $this->belongsTo(Invoice::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
