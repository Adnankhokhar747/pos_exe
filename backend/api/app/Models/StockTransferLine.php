<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockTransferLine extends Model
{
    protected $table = 'stock_transfer_lines';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','stock_transfer_id','product_id','quantity'];
}
