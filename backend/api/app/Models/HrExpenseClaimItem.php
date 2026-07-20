<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrExpenseClaimItem extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_expense_claim_items';

    protected $fillable = [
        'id', 'claim_id', 'expense_date', 'category', 'description', 'amount', 'receipt_ref',
    ];

    protected $casts = [
        'expense_date' => 'date:Y-m-d',
        'amount'       => 'decimal:2',
    ];

    public function claim()
    {
        return $this->belongsTo(HrExpenseClaim::class, 'claim_id');
    }
}
