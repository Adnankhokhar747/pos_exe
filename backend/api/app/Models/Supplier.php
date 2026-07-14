<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'suppliers';

    protected $fillable = [
        'id','tenant_id','name','phone','email','address','tax_number','current_balance','is_active',
    ];

    public function purchaseOrders(): HasMany { return $this->hasMany(PurchaseOrder::class); }
    public function supplierInvoices(): HasMany { return $this->hasMany(SupplierInvoice::class); }
    public function payments(): HasMany { return $this->hasMany(SupplierPayment::class); }
    public function ledgerEntries(): HasMany { return $this->hasMany(SupplierLedgerEntry::class); }
}
