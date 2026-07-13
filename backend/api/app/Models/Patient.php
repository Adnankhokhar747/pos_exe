<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Patient extends Model
{
    protected $table = 'patients';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id','tenant_id','name','phone','gender','date_of_birth','address','is_active','current_balance',
    ];

    protected $casts = ['date_of_birth' => 'date'];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function appointments(): HasMany { return $this->hasMany(Appointment::class); }
    public function ledgerEntries(): HasMany { return $this->hasMany(PatientLedgerEntry::class); }
    public function posInvoices(): HasMany { return $this->hasMany(Invoice::class); }
}
