<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\HasUuidPrimaryKey;

class LabResult extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'lab_results';

    protected $fillable = [
        'id', 'order_item_id', 'order_id', 'patient_id',
        'result_value', 'result_flag', 'remarks', 'entered_by', 'verified_by',
    ];

    public function orderItem() { return $this->belongsTo(LabOrderItem::class, 'order_item_id'); }
    public function order()     { return $this->belongsTo(LabOrder::class, 'order_id'); }
}
