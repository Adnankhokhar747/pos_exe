<?php

namespace App\Models\Concerns;

use Illuminate\Support\Str;

/**
 * Generates a UUID primary key in PHP before insert.
 * Works on any database (PostgreSQL, MySQL 5.7+, MySQL 8+, SQLite).
 */
trait HasUuidPrimaryKey
{
    protected static function bootHasUuidPrimaryKey(): void
    {
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function getIncrementing(): bool
    {
        return false;
    }

    public function getKeyType(): string
    {
        return 'string';
    }
}
