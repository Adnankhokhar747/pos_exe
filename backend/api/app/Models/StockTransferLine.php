<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class StockTransferLine extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'stock_transfer_lines';
    public $timestamps = false;

    protected $fillable = ['id','stock_transfer_id','product_id','quantity'];
}
