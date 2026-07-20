<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrApplicant extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_applicants';

    protected $fillable = [
        'id', 'tenant_id', 'job_id', 'name', 'email', 'phone', 'nationality',
        'stage', 'cv_notes', 'interview_date', 'offered_salary',
        'rejection_reason', 'hired_employee_id', 'notes',
    ];

    protected $casts = [
        'interview_date'  => 'date:Y-m-d',
        'offered_salary'  => 'decimal:2',
    ];

    public function job()
    {
        return $this->belongsTo(HrJob::class, 'job_id');
    }

    public function hiredEmployee()
    {
        return $this->belongsTo(HrEmployee::class, 'hired_employee_id');
    }
}
