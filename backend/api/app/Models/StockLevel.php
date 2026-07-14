<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class StockLevel extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'stock_levels';
    public $timestamps = false;

    protected $primaryKey = null;
    protected $fillable = ['warehouse_id','product_id','quantity_on_hand','quantity_reserved'];
}
