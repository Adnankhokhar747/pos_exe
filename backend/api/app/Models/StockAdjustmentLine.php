<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockAdjustmentLine extends Model
{
    protected $table = 'stock_adjustment_lines';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','stock_adjustment_id','product_id','counted_quantity','system_quantity'];
}
