<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class TenantCloudBackup extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'tenant_cloud_backup_settings';

    protected $fillable = [
        'tenant_id',
        'enabled',
        'auto_backup',
        'max_snapshots',
        'last_backed_up_at',
    ];

    protected $casts = [
        'enabled'          => 'boolean',
        'auto_backup'      => 'boolean',
        'last_backed_up_at' => 'datetime',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
