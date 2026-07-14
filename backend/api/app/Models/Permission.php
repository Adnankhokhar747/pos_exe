<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;

use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasUuidPrimaryKey;
protected $table = 'permissions';
    public $timestamps = false;

    protected $fillable = ['id','code','module','description'];
}
