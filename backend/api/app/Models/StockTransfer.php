<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockTransfer extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'stock_transfers';
    public $timestamps = false;

    protected $fillable = ['id','from_warehouse_id','to_warehouse_id','status','created_at'];

    public function lines(): HasMany { return $this->hasMany(StockTransferLine::class); }
}
