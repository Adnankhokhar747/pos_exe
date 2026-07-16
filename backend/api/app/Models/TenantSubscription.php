<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSubscription extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'tenant_subscriptions';

    protected $fillable = [
        'id','tenant_id','plan_id','start_date','expiry_date','status','grace_period_days',
    ];

    protected $casts = ['start_date' => 'datetime','expiry_date' => 'datetime'];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function plan(): BelongsTo { return $this->belongsTo(Plan::class); }
}
