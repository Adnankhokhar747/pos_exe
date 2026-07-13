<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $table = 'products';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id','tenant_id','sku','barcode','name','description','category_id',
        'cost_price','sale_price','tax_rate_pct','tax_template_id','reorder_level',
        'parent_product_id','variant_attributes','is_bundle','track_batches','track_serials','deleted_at',
    ];

    protected $casts = [
        'variant_attributes' => 'array',
        'is_bundle'    => 'boolean',
        'track_batches'=> 'boolean',
        'track_serials'=> 'boolean',
        'deleted_at'   => 'datetime',
    ];

    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function taxTemplate(): BelongsTo { return $this->belongsTo(TaxTemplate::class); }
    public function parentProduct(): BelongsTo { return $this->belongsTo(Product::class, 'parent_product_id'); }
    public function variants(): HasMany { return $this->hasMany(Product::class, 'parent_product_id'); }
    public function stockLevels(): HasMany { return $this->hasMany(StockLevel::class); }
}
