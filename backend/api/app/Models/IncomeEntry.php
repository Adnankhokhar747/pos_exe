<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncomeEntry extends Model
{
    protected $table = 'income_entries';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id','branch_id','category','amount','note','occurred_at','void_reason','voided_by','voided_at',
    ];
}
