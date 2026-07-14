<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Warehouse extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'warehouses';
    public $timestamps = false;

    protected $fillable = ['id','branch_id','name','is_default'];

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function stockLevels(): HasMany { return $this->hasMany(StockLevel::class); }
    public function stockLedger(): HasMany { return $this->hasMany(StockLedgerEntry::class); }
    public function purchaseOrders(): HasMany { return $this->hasMany(PurchaseOrder::class); }
    public function goodsReceipts(): HasMany { return $this->hasMany(GoodsReceipt::class); }
    public function stockAdjustments(): HasMany { return $this->hasMany(StockAdjustment::class); }
    public function batches(): HasMany { return $this->hasMany(Batch::class); }
    public function serialNumbers(): HasMany { return $this->hasMany(SerialNumber::class); }
}
