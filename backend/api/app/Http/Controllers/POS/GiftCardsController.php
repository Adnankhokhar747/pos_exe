<?php

namespace App\Http\Controllers\POS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\GiftCard;
use App\Models\GiftCardTransaction;
use Illuminate\Support\Facades\DB;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class GiftCardsController extends Controller
{
    public function index(Request $request)
    {
        return GiftCard::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('issued_at')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'initialBalance' => 'required|numeric|min:0',
        ]);

        $tenantId = $request->user()->tenant_id;
        $code = $request->code
            ? strtoupper($request->code)
            : strtoupper(bin2hex(random_bytes(5)));

        $exists = GiftCard::where('tenant_id', $tenantId)->where('code', $code)->exists();
        if ($exists) throw new ConflictException("Gift card code '{$code}' already exists.");

        return DB::transaction(function () use ($request, $tenantId, $code) {
            $initialBalance = $request->initialBalance;

            $card = GiftCard::create([
                'id'              => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'       => $tenantId,
                'code'            => $code,
                'initial_balance' => $initialBalance,
                'current_balance' => $initialBalance,
                'expiry_date'     => $request->expiryDate,
                'is_active'       => true,
                'issued_at'       => now(),
            ]);

            GiftCardTransaction::create([
                'id'          => (string) \Illuminate\Support\Str::uuid(),
                'gift_card_id'=> $card->id,
                'type'        => 'issue',
                'amount'      => $initialBalance,
                'balance_after'=> $initialBalance,
                'occurred_at' => now(),
            ]);

            return $card;
        });
    }

    public function show(Request $request, string $id)
    {
        $card = GiftCard::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$card) throw new NotFoundException("Gift card {$id} not found.");
        return $card;
    }

    public function getBalance(Request $request, string $code)
    {
        $tenantId = $request->user()->tenant_id;
        $card = GiftCard::where('tenant_id', $tenantId)->where('code', strtoupper($code))->first();
        if (!$card) throw new NotFoundException("Gift card '{$code}' not found.");
        return response()->json([
            'code'           => $card->code,
            'currentBalance' => (string) $card->current_balance,
            'isActive'       => $card->is_active,
        ]);
    }

    public function reload(Request $request, string $code)
    {
        $request->validate(['amount' => 'required|numeric|min:0.01']);

        $tenantId = $request->user()->tenant_id;
        $card = GiftCard::where('tenant_id', $tenantId)->where('code', strtoupper($code))->first();
        if (!$card) throw new NotFoundException("Gift card '{$code}' not found.");

        return DB::transaction(function () use ($request, $card) {
            $amount = (float) $request->amount;
            $newBalance = (float) $card->current_balance + $amount;

            $card->update(['current_balance' => $newBalance]);

            GiftCardTransaction::create([
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'gift_card_id' => $card->id,
                'type'         => 'reload',
                'amount'       => $amount,
                'balance_after'=> $newBalance,
                'occurred_at'  => now(),
            ]);

            return $card->fresh();
        });
    }

    public function update(Request $request, string $id)
    {
        $card = GiftCard::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$card) throw new NotFoundException("Gift card {$id} not found.");

        $card->update(array_filter([
            'expiry_date' => $request->expiryDate,
            'is_active'   => $request->isActive,
        ], fn($v) => $v !== null));

        return $card;
    }

    public function destroy(Request $request, string $id)
    {
        $card = GiftCard::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$card) throw new NotFoundException("Gift card {$id} not found.");
        $card->update(['is_active' => false]);
        return response()->json(['message' => 'Gift card deactivated.']);
    }
}
