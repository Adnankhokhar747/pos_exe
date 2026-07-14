<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class CustomerLedgerEntry extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'customer_ledger_entries';
    public $timestamps = false;

    protected $fillable = [
        'id','customer_id','entry_type','amount','balance_after',
        'reference_table','reference_id','note','occurred_at',
    ];

    protected $casts = ['occurred_at' => 'datetime'];
}
