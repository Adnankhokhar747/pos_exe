<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrAttendance extends Model
{
    protected $table = 'hr_attendance';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'work_date',
        'clock_in', 'clock_out', 'status',
        'work_minutes', 'overtime_minutes', 'notes', 'created_by',
    ];

    protected $casts = [
        'work_date'        => 'date',
        'clock_in'         => 'datetime',
        'clock_out'        => 'datetime',
        'work_minutes'     => 'integer',
        'overtime_minutes' => 'integer',
    ];

    public function employee() { return $this->belongsTo(HrEmployee::class, 'employee_id'); }
}
