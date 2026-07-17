<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\PatientAccount;

class BookingAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $bearerToken = $request->bearerToken();

        if (empty($bearerToken)) {
            return response()->json([
                'error'   => 'unauthenticated',
                'message' => 'No token provided.',
            ], 401);
        }

        $account = PatientAccount::where('remember_token', $bearerToken)->first();

        if (!$account) {
            return response()->json([
                'error'   => 'unauthenticated',
                'message' => 'Invalid or expired token.',
            ], 401);
        }

        $request->attributes->set('bookingAccount', $account);

        return $next($request);
    }
}
