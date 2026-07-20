<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\HasUuidPrimaryKey;

class LabOrderItem extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'lab_order_items';

    protected $fillable = [
        'id', 'order_id', 'test_id', 'test_code', 'test_name',
        'unit', 'normal_range', 'price', 'status',
        'collected_at', 'resulted_at', 'verified_at',
    ];

    protected $casts = [
        'price'        => 'decimal:2',
        'collected_at' => 'datetime',
        'resulted_at'  => 'datetime',
        'verified_at'  => 'datetime',
    ];

    public function order()  { return $this->belongsTo(LabOrder::class, 'order_id'); }
    public function test()   { return $this->belongsTo(LabTest::class, 'test_id'); }
    public function result() { return $this->hasOne(LabResult::class, 'order_item_id'); }
}
