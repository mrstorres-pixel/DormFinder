<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoomOptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $monthlyFees = $this->fees->where('frequency', 'monthly')->sum('amount_centavos');
        $oneTimeFees = $this->fees->where('frequency', 'one_time')->sum('amount_centavos');

        return [
            'id' => $this->id, 'name' => $this->name,
            'inventory_type' => $this->inventory_type, 'price_basis' => $this->price_basis,
            'capacity' => $this->capacity, 'total_units' => $this->total_units,
            'available_units' => $this->available_units,
            'monthly_rent_centavos' => $this->monthly_rent_centavos,
            'deposit_centavos' => $this->deposit_centavos, 'advance_months' => $this->advance_months,
            'utilities_notes' => $this->utilities_notes,
            'fees' => $this->fees->map(fn ($fee) => ['name' => $fee->name, 'frequency' => $fee->frequency, 'amount_centavos' => $fee->amount_centavos]),
            'monthly_fixed_total_centavos' => $this->monthly_rent_centavos + $monthlyFees,
            'move_in_fixed_total_centavos' => $this->deposit_centavos + $this->advance_months * $this->monthly_rent_centavos + $oneTimeFees,
            'availability_confirmed_at' => $this->availability_confirmed_at,
            'availability_stale' => $this->availability_confirmed_at->lt(now()->subDays(14)),
        ];
    }
}
