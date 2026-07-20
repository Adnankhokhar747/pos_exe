<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrJob extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_jobs';

    protected $fillable = [
        'id', 'tenant_id', 'title', 'department', 'description',
        'requirements', 'positions_count', 'status', 'deadline', 'created_by',
    ];

    protected $casts = [
        'positions_count' => 'integer',
        'deadline'        => 'date:Y-m-d',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function applicants()
    {
        return $this->hasMany(HrApplicant::class, 'job_id');
    }
}
