<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Currency;
use App\Models\ExchangeRate;
use App\Exceptions\NotFoundException;
use Illuminate\Support\Str;

class CurrenciesController extends Controller
{
    public function index()
    {
        return Currency::orderBy('code')->get();
    }

    public function show(string $code)
    {
        $currency = Currency::find($code);
        if (!$currency) throw new NotFoundException("Currency {$code} not found.");
        return $currency;
    }

    public function upsert(Request $request)
    {
        $request->validate([
            'code'   => 'required|string|size:3',
            'name'   => 'required|string',
            'symbol' => 'required|string',
        ]);

        $currency = Currency::updateOrCreate(
            ['code' => strtoupper($request->code)],
            [
                'name'           => $request->name,
                'symbol'         => $request->symbol,
                'decimal_places' => $request->decimalPlaces ?? 2,
            ]
        );
        return $currency;
    }

    public function update(Request $request, string $code)
    {
        $currency = Currency::find($code);
        if (!$currency) throw new NotFoundException("Currency {$code} not found.");

        $data = array_filter([
            'name'           => $request->name,
            'symbol'         => $request->symbol,
            'decimal_places' => $request->decimalPlaces,
        ], fn($v) => $v !== null);

        $currency->update($data);
        return $currency;
    }

    public function destroy(string $code)
    {
        $currency = Currency::find($code);
        if (!$currency) throw new NotFoundException("Currency {$code} not found.");

        $inUse = \Illuminate\Support\Facades\DB::table('tenants')
            ->where('base_currency', $code)->exists();
        if ($inUse) {
            return response()->json(['error' => 'currency_in_use', 'message' => 'Currency is the base currency for a tenant.'], 409);
        }

        $currency->delete();
        return $currency;
    }

    public function listExchangeRates(string $code)
    {
        return ExchangeRate::where('currency_code', $code)
            ->orderByDesc('effective_at')
            ->take(100)
            ->get();
    }

    public function recordExchangeRate(Request $request, string $code)
    {
        $request->validate(['rateToBase' => 'required|numeric|min:0']);
        return ExchangeRate::create([
            'id'            => (string) Str::uuid(),
            'currency_code' => $code,
            'rate_to_base'  => $request->rateToBase,
            'effective_at'  => now(),
        ]);
    }
}
