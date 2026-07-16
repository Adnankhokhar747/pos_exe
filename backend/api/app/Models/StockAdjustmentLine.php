<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class StockAdjustmentLine extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'stock_adjustment_lines';
    public $timestamps = false;

    protected $fillable = ['id','stock_adjustment_id','product_id','counted_quantity','system_quantity'];
}
