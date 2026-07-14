<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentBillLine extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'appointment_bill_lines';
    public $timestamps = false;

    protected $fillable = [
        'id','bill_id','line_type','product_id','description','quantity','unit_price','line_total',
    ];

    public function bill(): BelongsTo { return $this->belongsTo(AppointmentBill::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
