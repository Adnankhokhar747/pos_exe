<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'invoices';

    protected $fillable = [
        'id','branch_id','invoice_no','invoice_type','status','customer_id','patient_id',
        'subtotal','discount_total','tax_total','grand_total','cashier_id','held_label',
        'original_invoice_id','void_reason','voided_by','voided_at','currency_code',
        'exchange_rate_to_base','loyalty_points_earned','loyalty_points_redeemed',
        'coupon_code','coupon_discount_amount',
    ];

    protected $casts = ['voided_at' => 'datetime'];

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }
    public function lines(): HasMany { return $this->hasMany(InvoiceLine::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }
}
