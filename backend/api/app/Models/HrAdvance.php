<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrAdvance extends Model
{
    protected $table = 'hr_advances';

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'amount', 'remaining_balance',
        'deduction_type', 'monthly_installment', 'total_installments',
        'installments_paid', 'status', 'issued_date', 'notes', 'created_by',
    ];

    public $incrementing = false;
    protected $keyType = 'string';

    public function employee()
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }
}
