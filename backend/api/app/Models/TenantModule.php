<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantModule extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'tenant_modules';

    protected $fillable = [
        'id','tenant_id','module_id','enabled','start_date','expiry_date','grace_period_days','limits',
    ];

    protected $casts = [
        'limits'      => 'array',
        'start_date'  => 'datetime',
        'expiry_date' => 'datetime',
        'enabled'     => 'boolean',
    ];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function module(): BelongsTo { return $this->belongsTo(ModuleCatalog::class, 'module_id'); }
}
