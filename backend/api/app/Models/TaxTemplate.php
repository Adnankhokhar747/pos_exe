<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class TaxTemplate extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'tax_templates';
    public $timestamps = false;

    protected $fillable = ['id','tenant_id','name','tax_type','rate_pct','is_inclusive','is_active'];
}
