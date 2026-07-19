<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrPayslip extends Model
{
    protected $table = 'hr_payslips';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'payroll_run_id', 'tenant_id', 'employee_id', 'month', 'year',
        'working_days', 'present_days', 'absent_days', 'paid_leave_days',
        'unpaid_leave_days', 'late_count', 'overtime_hours',
        'basic_salary', 'housing_allowance', 'transport_allowance', 'other_allowances',
        'gross_salary', 'absent_deduction', 'unpaid_leave_deduction',
        'late_deduction', 'other_deductions', 'overtime_pay', 'net_salary', 'status',
    ];

    protected $casts = [
        'month'                  => 'integer',
        'year'                   => 'integer',
        'working_days'           => 'integer',
        'present_days'           => 'integer',
        'absent_days'            => 'integer',
        'paid_leave_days'        => 'integer',
        'unpaid_leave_days'      => 'integer',
        'late_count'             => 'integer',
        'overtime_hours'         => 'decimal:2',
        'basic_salary'           => 'decimal:2',
        'housing_allowance'      => 'decimal:2',
        'transport_allowance'    => 'decimal:2',
        'other_allowances'       => 'decimal:2',
        'gross_salary'           => 'decimal:2',
        'absent_deduction'       => 'decimal:2',
        'unpaid_leave_deduction' => 'decimal:2',
        'late_deduction'         => 'decimal:2',
        'other_deductions'       => 'decimal:2',
        'overtime_pay'           => 'decimal:2',
        'net_salary'             => 'decimal:2',
    ];

    public function employee()   { return $this->belongsTo(HrEmployee::class, 'employee_id'); }
    public function payrollRun() { return $this->belongsTo(HrPayrollRun::class, 'payroll_run_id'); }
}
