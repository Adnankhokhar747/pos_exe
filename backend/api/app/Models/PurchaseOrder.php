<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\SupplierPayment;

class PurchaseOrder extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'purchase_orders';

    protected $fillable = [
        'id','tenant_id','supplier_id','warehouse_id','order_no','status',
        'void_reason','voided_by','voided_at',
    ];

    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function warehouse(): BelongsTo { return $this->belongsTo(Warehouse::class); }
    public function lines(): HasMany { return $this->hasMany(PurchaseOrderLine::class); }
    public function goodsReceipts(): HasMany { return $this->hasMany(GoodsReceipt::class); }
    public function payments(): HasMany { return $this->hasMany(SupplierPayment::class); }
}
