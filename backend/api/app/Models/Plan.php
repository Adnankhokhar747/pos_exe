<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'plans';
    public $timestamps = false;

    protected $fillable = ['id','name','user_limit','invoice_limit','branch_limit','price_monthly','is_active'];

    protected $casts = ['created_at' => 'datetime'];
}
