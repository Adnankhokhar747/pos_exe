<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestaurantSplitBill extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'restaurant_split_bills';

    protected $fillable = [
        'id', 'tenant_id', 'session_id', 'split_count', 'total_amount', 'status',
    ];

    protected $casts = [
        'split_count'  => 'integer',
        'total_amount' => 'float',
    ];

    public function session(): BelongsTo { return $this->belongsTo(RestaurantTableSession::class, 'session_id'); }
    public function parties(): HasMany { return $this->hasMany(RestaurantSplitBillParty::class, 'split_bill_id'); }
}
