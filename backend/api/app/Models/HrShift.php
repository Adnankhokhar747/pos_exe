<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrShift extends Model
{
    protected $table = 'hr_shifts';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'name', 'start_time', 'end_time', 'grace_minutes', 'is_active',
    ];

    protected $casts = [
        'grace_minutes' => 'integer',
        'is_active'     => 'boolean',
    ];
}
