<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CamelCaseResponse
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        if ($response instanceof JsonResponse) {
            $response->setData($this->toCamel($response->getData(true)));
        }

        return $response;
    }

    private function toCamel(mixed $data): mixed
    {
        if (!is_array($data)) {
            return $data;
        }

        $out = [];
        foreach ($data as $key => $value) {
            $newKey = is_string($key) ? $this->camelKey($key) : $key;
            $out[$newKey] = $this->toCamel($value);
        }
        return $out;
    }

    private function camelKey(string $key): string
    {
        // Already camelCase (no underscores) — return as-is.
        if (!str_contains($key, '_')) {
            return $key;
        }
        return lcfirst(str_replace('_', '', ucwords($key, '_')));
    }
}
