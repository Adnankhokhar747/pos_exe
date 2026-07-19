<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrEmployee extends Model
{
    protected $table = 'hr_employees';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'user_id', 'employee_code', 'name', 'email', 'phone',
        'department', 'job_title', 'join_date', 'shift_id',
        'salary_type', 'basic_salary', 'housing_allowance', 'transport_allowance',
        'other_allowances', 'annual_leave_days', 'overtime_rate', 'is_active', 'notes',
    ];

    protected $casts = [
        'join_date'           => 'date',
        'basic_salary'        => 'decimal:2',
        'housing_allowance'   => 'decimal:2',
        'transport_allowance' => 'decimal:2',
        'other_allowances'    => 'decimal:2',
        'overtime_rate'       => 'decimal:2',
        'is_active'           => 'boolean',
    ];

    public function shift()    { return $this->belongsTo(HrShift::class, 'shift_id'); }
    public function user()     { return $this->belongsTo(User::class, 'user_id'); }
    public function attendance() { return $this->hasMany(HrAttendance::class, 'employee_id'); }
    public function leaves()   { return $this->hasMany(HrLeave::class, 'employee_id'); }
    public function payslips() { return $this->hasMany(HrPayslip::class, 'employee_id'); }

    public function grossSalary(): float
    {
        return (float)$this->basic_salary
            + (float)$this->housing_allowance
            + (float)$this->transport_allowance
            + (float)$this->other_allowances;
    }
}
