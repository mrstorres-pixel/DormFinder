<?php

namespace Database\Factories;

use App\Models\Inquiry;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Inquiry> */
class InquiryFactory extends Factory
{
    public function definition(): array
    {
        return ['property_id' => Property::factory(), 'student_id' => User::factory(), 'landlord_id' => fn (array $values) => Property::findOrFail($values['property_id'])->landlord_id, 'listing_snapshot' => ['title' => 'Synthetic listing'], 'last_message_at' => now()];
    }
}
