<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class Printer extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'printers';

    protected $fillable = [
        'id','tenant_id','branch_id','name','type','system_printer_name','is_default_receipt','is_default_invoice',
    ];
}
