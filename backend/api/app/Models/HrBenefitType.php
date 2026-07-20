<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrBenefitType extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_benefit_types';

    protected $fillable = [
        'id', 'tenant_id', 'name', 'description', 'is_taxable', 'is_active',
    ];

    protected $casts = [
        'is_taxable' => 'boolean',
        'is_active'  => 'boolean',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function employeeBenefits()
    {
        return $this->hasMany(HrEmployeeBenefit::class, 'benefit_type_id');
    }
}
