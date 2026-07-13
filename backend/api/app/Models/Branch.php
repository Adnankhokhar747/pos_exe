<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    protected $table = 'branches';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['id','tenant_id','name','code','timezone','is_active'];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function warehouses(): HasMany { return $this->hasMany(Warehouse::class); }
    public function invoices(): HasMany { return $this->hasMany(Invoice::class); }
    public function cashDrawerSessions(): HasMany { return $this->hasMany(CashDrawerSession::class); }
    public function expenses(): HasMany { return $this->hasMany(Expense::class); }
    public function incomeEntries(): HasMany { return $this->hasMany(IncomeEntry::class); }
    public function dailyClosings(): HasMany { return $this->hasMany(DailyClosing::class); }
    public function printers(): HasMany { return $this->hasMany(Printer::class); }
}
