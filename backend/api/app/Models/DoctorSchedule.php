<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoctorSchedule extends Model
{
    protected $table = 'doctor_schedules';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','doctor_id','day_of_week','start_time','end_time'];

    public function doctor(): BelongsTo { return $this->belongsTo(Doctor::class); }
}
