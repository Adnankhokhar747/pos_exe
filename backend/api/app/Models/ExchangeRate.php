<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'exchange_rates';
    public $timestamps = false;

    protected $fillable = ['id', 'currency_code', 'rate_to_base', 'effective_at'];
}
