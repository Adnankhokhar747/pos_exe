<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class CashDrawerSession extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'cash_drawer_sessions';
    public $timestamps = false;

    protected $fillable = [
        'id','branch_id','opened_by','closed_by','opening_float',
        'expected_close','closing_count','variance','opened_at','closed_at',
    ];

    protected $casts = ['opened_at' => 'datetime','closed_at' => 'datetime'];
}
