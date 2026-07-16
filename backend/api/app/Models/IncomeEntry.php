<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class IncomeEntry extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'income_entries';
    public $timestamps = false;

    protected $fillable = [
        'id','branch_id','category','amount','note','occurred_at','void_reason','voided_by','voided_at',
    ];
}
