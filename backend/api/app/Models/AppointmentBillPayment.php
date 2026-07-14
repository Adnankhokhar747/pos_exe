<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class AppointmentBillPayment extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'appointment_bill_payments';
    public $timestamps = false;

    protected $fillable = ['id','bill_id','method','amount','reference'];
}
