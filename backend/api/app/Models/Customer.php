<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'customers';

    protected $fillable = [
        'id','tenant_id','name','phone','email','address','tax_number',
        'credit_limit','current_balance','loyalty_points','is_active','is_walk_in',
    ];

    public function invoices(): HasMany { return $this->hasMany(Invoice::class); }
    public function ledgerEntries(): HasMany { return $this->hasMany(CustomerLedgerEntry::class); }
    public function loyaltyTransactions(): HasMany { return $this->hasMany(LoyaltyTransaction::class); }
}
