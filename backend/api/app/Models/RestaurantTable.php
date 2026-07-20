<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RestaurantTable extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'restaurant_tables';

    protected $fillable = [
        'id', 'tenant_id', 'branch_id', 'table_number', 'label',
        'capacity', 'status', 'section', 'notes', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean', 'capacity' => 'integer'];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function sessions(): HasMany { return $this->hasMany(RestaurantTableSession::class, 'table_id'); }
    public function activeSession(): HasOne {
        return $this->hasOne(RestaurantTableSession::class, 'table_id')->whereNull('closed_at');
    }
}
