<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class ReceiptSettings extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'receipt_settings';

    protected $fillable = ['id','tenant_id','header_text','footer_text','paper_width_mm'];
}
