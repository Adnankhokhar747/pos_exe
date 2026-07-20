<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrEndOfServiceRecord extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_end_of_service_records';

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'employee_name', 'join_date', 'end_date',
        'reason', 'basic_salary', 'years_of_service', 'qualifying_years',
        'eosb_amount', 'calculation_notes', 'approved_by',
    ];

    protected $casts = [
        'join_date'        => 'date:Y-m-d',
        'end_date'         => 'date:Y-m-d',
        'basic_salary'     => 'decimal:2',
        'years_of_service' => 'decimal:4',
        'qualifying_years' => 'decimal:4',
        'eosb_amount'      => 'decimal:2',
    ];

    public function employee()
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(\App\Models\User::class, 'approved_by');
    }
}
