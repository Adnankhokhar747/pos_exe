<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Doctor extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'doctors';

    protected $fillable = [
        'id','tenant_id','linked_user_id','name','specialization',
        'phone','email','room_number','consultation_fee','is_active',
        'max_daily_appointments',
    ];

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function linkedUser(): BelongsTo { return $this->belongsTo(User::class, 'linked_user_id'); }
    public function schedules(): HasMany { return $this->hasMany(DoctorSchedule::class); }
    public function appointments(): HasMany { return $this->hasMany(Appointment::class); }
}
