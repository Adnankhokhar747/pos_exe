<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksBookingModule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\Patient;
use App\Models\PatientAccount;

class BookingAuthController extends Controller
{
    use ChecksBookingModule;
    public function register(Request $request)
    {
        $request->validate([
            'tenantId' => 'required|string',
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|max:255',
            'password' => 'required|string|min:6',
            'phone'    => 'nullable|string|max:50',
        ]);

        $tenantId = $request->tenantId;

        if ($err = $this->bookingModuleCheck($tenantId)) return $err;

        // Check uniqueness per tenant+email
        $exists = PatientAccount::where('tenant_id', $tenantId)
            ->where('email', $request->email)
            ->exists();

        if ($exists) {
            return response()->json([
                'error'   => 'validation_error',
                'message' => 'An account with this email already exists for this organisation.',
                'errors'  => ['email' => ['Email is already registered.']],
            ], 422);
        }

        return DB::transaction(function () use ($request, $tenantId) {
            // Create a Patient record linked to this account
            $patient = Patient::create([
                'id'        => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'name'      => $request->name,
                'phone'     => $request->phone,
                'is_active' => true,
            ]);

            $token = Str::random(60);

            $account = PatientAccount::create([
                'id'             => (string) Str::uuid(),
                'tenant_id'      => $tenantId,
                'patient_id'     => $patient->id,
                'name'           => $request->name,
                'email'          => $request->email,
                'password'       => Hash::make($request->password),
                'phone'          => $request->phone,
                'remember_token' => $token,
            ]);

            return response()->json([
                'token'   => $token,
                'account' => [
                    'id'        => $account->id,
                    'name'      => $account->name,
                    'email'     => $account->email,
                    'patientId' => $account->patient_id,
                ],
            ], 201);
        });
    }

    public function login(Request $request)
    {
        $request->validate([
            'tenantId' => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if ($err = $this->bookingModuleCheck($request->tenantId)) return $err;

        $account = PatientAccount::where('tenant_id', $request->tenantId)
            ->where('email', $request->email)
            ->first();

        if (!$account || !Hash::check($request->password, $account->password)) {
            return response()->json([
                'error'   => 'unauthenticated',
                'message' => 'Invalid email or password.',
            ], 401);
        }

        $token = Str::random(60);
        $account->update(['remember_token' => $token]);

        return response()->json([
            'token'   => $token,
            'account' => [
                'id'        => $account->id,
                'name'      => $account->name,
                'email'     => $account->email,
                'patientId' => $account->patient_id,
            ],
        ]);
    }

    public function me(Request $request)
    {
        /** @var \App\Models\PatientAccount $account */
        $account = $request->attributes->get('bookingAccount');

        return response()->json([
            'id'        => $account->id,
            'name'      => $account->name,
            'email'     => $account->email,
            'phone'     => $account->phone,
            'patientId' => $account->patient_id,
            'tenantId'  => $account->tenant_id,
        ]);
    }
}
