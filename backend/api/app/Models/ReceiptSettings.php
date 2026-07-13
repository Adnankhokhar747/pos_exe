<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReceiptSettings extends Model
{
    protected $table = 'receipt_settings';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['id','tenant_id','header_text','footer_text','paper_width_mm'];
}
