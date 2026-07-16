<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'tenants';

    protected $fillable = [
        'id','name','base_currency','status','address','tax_number','logo_path','default_tax_template_id',
    ];

    public function branches(): HasMany { return $this->hasMany(Branch::class); }
    public function users(): HasMany { return $this->hasMany(User::class); }
    public function roles(): HasMany { return $this->hasMany(Role::class); }
    public function subscription(): HasOne { return $this->hasOne(TenantSubscription::class); }
    public function tenantModules(): HasMany { return $this->hasMany(TenantModule::class); }
    public function doctors(): HasMany { return $this->hasMany(Doctor::class); }
    public function patients(): HasMany { return $this->hasMany(Patient::class); }
    public function appointments(): HasMany { return $this->hasMany(Appointment::class); }
}
