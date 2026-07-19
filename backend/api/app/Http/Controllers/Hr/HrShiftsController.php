<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrShift;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HrShiftsController extends Controller
{
    public function index(Request $request)
    {
        return HrShift::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get()
            ->map(fn($s) => $this->format($s));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'          => 'required|string|max:100',
            'startTime'     => 'required|date_format:H:i',
            'endTime'       => 'required|date_format:H:i',
            'graceMinutes'  => 'nullable|integer|min:0|max:120',
        ]);

        $shift = HrShift::create([
            'id'            => (string) Str::uuid(),
            'tenant_id'     => $request->user()->tenant_id,
            'name'          => $request->name,
            'start_time'    => $request->startTime,
            'end_time'      => $request->endTime,
            'grace_minutes' => $request->graceMinutes ?? 15,
        ]);

        return response()->json($this->format($shift), 201);
    }

    public function update(Request $request, string $id)
    {
        $shift = HrShift::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $request->validate([
            'name'         => 'sometimes|string|max:100',
            'startTime'    => 'sometimes|date_format:H:i',
            'endTime'      => 'sometimes|date_format:H:i',
            'graceMinutes' => 'nullable|integer|min:0|max:120',
            'isActive'     => 'sometimes|boolean',
        ]);

        $data = array_filter([
            'name'          => $request->name,
            'start_time'    => $request->startTime,
            'end_time'      => $request->endTime,
            'grace_minutes' => $request->graceMinutes,
            'is_active'     => $request->has('isActive') ? (bool)$request->isActive : null,
        ], fn($v) => $v !== null);

        $shift->update($data);
        return response()->json($this->format($shift->fresh()));
    }

    private function format(HrShift $s): array
    {
        return [
            'id'           => $s->id,
            'name'         => $s->name,
            'startTime'    => $s->start_time,
            'endTime'      => $s->end_time,
            'graceMinutes' => $s->grace_minutes,
            'isActive'     => $s->is_active,
        ];
    }
}
