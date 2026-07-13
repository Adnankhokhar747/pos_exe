<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaxTemplate extends Model
{
    protected $table = 'tax_templates';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','tenant_id','name','tax_type','rate_pct','is_inclusive','is_active'];
}
