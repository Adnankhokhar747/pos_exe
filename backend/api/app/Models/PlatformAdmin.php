<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformAdmin extends Model
{
    protected $table = 'platform_admins';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id','username','email','full_name','password_hash'];
    protected $hidden = ['password_hash'];

    protected $casts = ['created_at' => 'datetime'];
}
