<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class TenantBackupSnapshot extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'tenant_backup_snapshots';

    protected $fillable = [
        'tenant_id',
        'version',
        'label',
        'snapshot_data',
        'size_bytes',
    ];

    protected $casts = [
        'snapshot_data' => 'array',
    ];
}
