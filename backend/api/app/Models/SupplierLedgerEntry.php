<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierLedgerEntry extends Model
{
    protected $table = 'supplier_ledger_entries';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id','supplier_id','entry_type','amount','balance_after',
        'reference_table','reference_id','note','occurred_at',
    ];

    protected $casts = ['occurred_at' => 'datetime'];
}
