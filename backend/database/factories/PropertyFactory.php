<?php

namespace Database\Factories;

use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Property> */
class PropertyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'landlord_id' => User::factory()->landlord(),
            'title' => fake()->words(3, true),
            'description' => 'A fictional property for automated testing.',
            'property_type' => 'dormitory',
            'address' => 'Demo address, Quiapo',
            'city' => 'Manila',
            'status' => 'draft',
            'revision' => 1,
        ];
    }
}
