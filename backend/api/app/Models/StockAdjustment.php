<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockAdjustment extends Model
{
    protected $table = 'stock_adjustments';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','warehouse_id','reason_code','note','status','created_at'];

    public function lines(): HasMany { return $this->hasMany(StockAdjustmentLine::class); }
}
