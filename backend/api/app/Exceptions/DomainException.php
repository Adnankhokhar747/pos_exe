<?php

namespace App\Exceptions;

use RuntimeException;

abstract class DomainException extends RuntimeException
{
    abstract public function getHttpStatus(): int;
    abstract public function getErrorCode(): string;

    public function __construct(string $message)
    {
        parent::__construct($message);
    }
}

class NotFoundException extends DomainException
{
    public function getHttpStatus(): int { return 404; }
    public function getErrorCode(): string { return 'not_found'; }
}

class ConflictException extends DomainException
{
    public function getHttpStatus(): int { return 409; }
    public function getErrorCode(): string { return 'conflict'; }
}

class ForbiddenException extends DomainException
{
    public function getHttpStatus(): int { return 403; }
    public function getErrorCode(): string { return 'forbidden'; }
}

class UnauthorizedException extends DomainException
{
    public function getHttpStatus(): int { return 401; }
    public function getErrorCode(): string { return 'unauthorized'; }
}

class LicenseBlockedError extends DomainException
{
    public function getHttpStatus(): int { return 403; }
    public function getErrorCode(): string { return 'license_blocked'; }
}

class ModuleBlockedError extends DomainException
{
    public function getHttpStatus(): int { return 403; }
    public function getErrorCode(): string { return 'module_blocked'; }
}

class LimitExceededError extends DomainException
{
    public function getHttpStatus(): int { return 409; }
    public function getErrorCode(): string { return 'limit_exceeded'; }
}

class InsufficientBalanceError extends DomainException
{
    public function getHttpStatus(): int { return 422; }
    public function getErrorCode(): string { return 'insufficient_balance'; }
}

class BillAlreadyFinalizedError extends DomainException
{
    public function getHttpStatus(): int { return 409; }
    public function getErrorCode(): string { return 'bill_already_finalized'; }
    public function __construct() { parent::__construct('This appointment bill has already been finalized.'); }
}

class InvalidStatusTransitionError extends DomainException
{
    public function getHttpStatus(): int { return 422; }
    public function getErrorCode(): string { return 'invalid_status_transition'; }
}
