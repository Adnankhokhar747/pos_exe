<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class User extends Authenticatable implements JWTSubject
{
    protected $table = 'users';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id','tenant_id','full_name','username','email','pin_hash','password_hash','status',
    ];

    protected $hidden = ['password_hash','pin_hash'];

    public function getJWTIdentifier() { return $this->getKey(); }
    public function getJWTCustomClaims(): array { return []; }

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function roles(): BelongsToMany { return $this->belongsToMany(Role::class, 'user_roles'); }
    public function doctorProfile(): HasOne { return $this->hasOne(Doctor::class, 'linked_user_id'); }

    public function getPermissions(): array
    {
        return $this->roles()
            ->with('permissions')
            ->get()
            ->flatMap(fn($r) => $r->permissions->pluck('code'))
            ->unique()
            ->values()
            ->toArray();
    }

    public function hasPermission(string $code): bool
    {
        return in_array($code, $this->getPermissions());
    }
}
