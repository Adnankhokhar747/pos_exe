<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\HasUuidPrimaryKey;

class LabTest extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'lab_tests';

    protected $fillable = [
        'id', 'tenant_id', 'code', 'name', 'category', 'unit',
        'normal_range', 'price', 'turnaround_hrs', 'is_active', 'notes',
    ];

    protected $casts = [
        'price'          => 'decimal:2',
        'turnaround_hrs' => 'integer',
        'is_active'      => 'boolean',
    ];

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
