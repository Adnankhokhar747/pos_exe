<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasUuidPrimaryKey;

class HrTaxSetting extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'hr_tax_settings';

    protected $fillable = [
        'id', 'tenant_id', 'is_enabled', 'tax_rate_pct', 'tax_free_amount', 'applies_to', 'notes',
    ];

    protected $casts = [
        'is_enabled'     => 'boolean',
        'tax_rate_pct'   => 'decimal:2',
        'tax_free_amount'=> 'decimal:2',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
