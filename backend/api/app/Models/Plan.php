<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $table = 'plans';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','name','user_limit','invoice_limit','branch_limit','price_monthly','is_active'];

    protected $casts = ['created_at' => 'datetime'];
}
