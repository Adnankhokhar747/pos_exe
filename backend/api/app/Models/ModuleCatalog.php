<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ModuleCatalog extends Model
{
    protected $table = 'module_catalog';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','code','name','description','is_active'];

    protected $casts = ['created_at' => 'datetime'];

    public function tenantModules(): HasMany { return $this->hasMany(TenantModule::class, 'module_id'); }
}
