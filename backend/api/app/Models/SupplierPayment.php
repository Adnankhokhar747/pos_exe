<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierPayment extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'supplier_payments';
    public $timestamps = false;

    protected $fillable = [
        'id','supplier_id','purchase_order_id','amount','method','void_reason','voided_by','voided_at','paid_at',
    ];

    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function purchaseOrder(): BelongsTo { return $this->belongsTo(PurchaseOrder::class); }
    public function allocations(): HasMany { return $this->hasMany(SupplierPaymentAllocation::class); }
}
