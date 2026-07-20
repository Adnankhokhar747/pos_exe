<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrExpenseClaim extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_expense_claims';

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'period_month', 'period_year',
        'description', 'total_amount', 'status', 'approved_by', 'approved_at',
        'rejection_reason', 'notes',
    ];

    protected $casts = [
        'period_month'  => 'integer',
        'period_year'   => 'integer',
        'total_amount'  => 'decimal:2',
        'approved_at'   => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }

    public function items()
    {
        return $this->hasMany(HrExpenseClaimItem::class, 'claim_id');
    }
}
