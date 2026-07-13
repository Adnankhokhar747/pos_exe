<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $table = 'payments';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id','invoice_id','method','amount','received_amount','change_amount','reference',
    ];

    public function invoice(): BelongsTo { return $this->belongsTo(Invoice::class); }
}
