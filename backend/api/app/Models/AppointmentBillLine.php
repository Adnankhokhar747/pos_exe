<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentBillLine extends Model
{
    protected $table = 'appointment_bill_lines';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id','bill_id','line_type','product_id','description','quantity','unit_price','line_total',
    ];

    public function bill(): BelongsTo { return $this->belongsTo(AppointmentBill::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
