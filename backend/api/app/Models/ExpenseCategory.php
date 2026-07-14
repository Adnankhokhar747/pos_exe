<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class ExpenseCategory extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'expense_categories';
    public $timestamps = false;

    protected $fillable = ['id','tenant_id','name'];
}
