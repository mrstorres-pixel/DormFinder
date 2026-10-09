<?php

namespace Database\Factories;

use App\Models\Property;
use App\Models\RoomOption;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<RoomOption> */
class RoomOptionFactory extends Factory
{
    public function definition(): array
    {
        return ['property_id' => Property::factory(), 'name' => fake()->unique()->words(3, true), 'inventory_type' => 'bedspace', 'price_basis' => 'per_person', 'capacity' => 4, 'total_units' => 8, 'available_units' => 3, 'monthly_rent_centavos' => 350000, 'deposit_centavos' => 350000, 'advance_months' => 1, 'utilities_notes' => 'Electricity billed by actual meter usage; water included.', 'availability_confirmed_at' => now()];
    }
}
