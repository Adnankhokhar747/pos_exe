<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrLeaveType extends Model
{
    protected $table = 'hr_leave_types';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'name', 'is_paid', 'days_per_year', 'is_active',
    ];

    protected $casts = [
        'is_paid'       => 'boolean',
        'days_per_year' => 'integer',
        'is_active'     => 'boolean',
    ];
}
