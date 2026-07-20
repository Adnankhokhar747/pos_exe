<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrEmployeeBenefit extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_employee_benefits';

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'benefit_type_id',
        'amount', 'effective_from', 'effective_to', 'notes',
    ];

    protected $casts = [
        'amount'         => 'decimal:2',
        'effective_from' => 'date:Y-m-d',
        'effective_to'   => 'date:Y-m-d',
    ];

    public function employee()
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }

    public function benefitType()
    {
        return $this->belongsTo(HrBenefitType::class, 'benefit_type_id');
    }
}
