<?php

namespace Database\Factories;

use App\Models\RoomOption;
use App\Models\RoomOptionFee;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<RoomOptionFee> */
class RoomOptionFeeFactory extends Factory
{
    public function definition(): array
    {
        return ['room_option_id' => RoomOption::factory(), 'name' => 'Internet', 'frequency' => 'monthly', 'amount_centavos' => 25000];
    }
}
