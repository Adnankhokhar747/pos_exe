<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrLeave extends Model
{
    protected $table = 'hr_leaves';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'leave_type_id',
        'from_date', 'to_date', 'days', 'reason',
        'status', 'approved_by', 'approved_at', 'rejection_reason', 'created_by',
    ];

    protected $casts = [
        'from_date'   => 'date',
        'to_date'     => 'date',
        'approved_at' => 'datetime',
        'days'        => 'integer',
    ];

    public function employee()  { return $this->belongsTo(HrEmployee::class, 'employee_id'); }
    public function leaveType() { return $this->belongsTo(HrLeaveType::class, 'leave_type_id'); }
}
