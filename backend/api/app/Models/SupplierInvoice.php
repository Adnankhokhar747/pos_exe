<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierInvoice extends Model
{
    protected $table = 'supplier_invoices';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id','supplier_id','goods_receipt_id','invoice_no','amount','amount_paid',
        'due_date','status','void_reason','voided_by','voided_at','created_at',
    ];

    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function goodsReceipt(): BelongsTo { return $this->belongsTo(GoodsReceipt::class); }
    public function allocations(): HasMany { return $this->hasMany(SupplierPaymentAllocation::class); }
}
