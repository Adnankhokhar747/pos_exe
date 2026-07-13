<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockLevel extends Model
{
    protected $table = 'stock_levels';
    public $timestamps = false;
    public $incrementing = false;

    protected $primaryKey = null;
    protected $fillable = ['warehouse_id','product_id','quantity_on_hand','quantity_reserved'];
}
