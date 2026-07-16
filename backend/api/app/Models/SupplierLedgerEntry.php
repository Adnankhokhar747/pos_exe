<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class SupplierLedgerEntry extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'supplier_ledger_entries';
    public $timestamps = false;

    protected $fillable = [
        'id','supplier_id','entry_type','amount','balance_after',
        'reference_table','reference_id','note','occurred_at',
    ];

    protected $casts = ['occurred_at' => 'datetime'];
}
