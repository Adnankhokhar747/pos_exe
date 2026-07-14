<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'expenses';
    public $timestamps = false;

    protected $fillable = [
        'id','branch_id','category_id','amount','note','paid_via',
        'occurred_at','void_reason','voided_by','voided_at',
    ];

    public function category(): BelongsTo { return $this->belongsTo(ExpenseCategory::class); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
}
