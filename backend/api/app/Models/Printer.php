<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Printer extends Model
{
    protected $table = 'printers';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id','tenant_id','branch_id','name','type','system_printer_name','is_default_receipt','is_default_invoice',
    ];
}
