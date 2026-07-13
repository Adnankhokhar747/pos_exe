<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyClosing extends Model
{
    protected $table = 'daily_closings';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id','branch_id','business_date','expected_cash','counted_cash',
        'variance','closed_by','closed_at','void_reason','voided_by','voided_at',
    ];

    protected $casts = ['business_date' => 'date','closed_at' => 'datetime'];
}
