<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppointmentBillPayment extends Model
{
    protected $table = 'appointment_bill_payments';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','bill_id','method','amount','reference'];
}
