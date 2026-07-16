<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class StockLedgerEntry extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'stock_ledger';
    public $timestamps = false;

    protected $fillable = [
        'id','warehouse_id','product_id','movement_type','quantity_delta',
        'unit_cost_at_movement','reference_table','reference_id','occurred_at',
    ];

    protected $casts = ['occurred_at' => 'datetime'];
}
