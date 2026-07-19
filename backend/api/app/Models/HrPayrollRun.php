<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrPayrollRun extends Model
{
    protected $table = 'hr_payroll_runs';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id', 'tenant_id', 'month', 'year', 'working_days', 'status',
        'total_gross', 'total_deductions', 'total_net',
        'notes', 'created_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'month'            => 'integer',
        'year'             => 'integer',
        'working_days'     => 'integer',
        'total_gross'      => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'total_net'        => 'decimal:2',
        'approved_at'      => 'datetime',
    ];

    public function payslips() { return $this->hasMany(HrPayslip::class, 'payroll_run_id'); }
}
