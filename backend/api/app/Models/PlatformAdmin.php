<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class PlatformAdmin extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'platform_admins';
    public $timestamps = false;

    protected $fillable = ['id','username','email','full_name','password_hash'];
    protected $hidden = ['password_hash'];

    protected $casts = ['created_at' => 'datetime'];
}
