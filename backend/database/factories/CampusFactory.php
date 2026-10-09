<?php

namespace Database\Factories;

use App\Models\Campus;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Campus>
 */
class CampusFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'slug' => fake()->unique()->slug(), 'name' => 'Synthetic test campus', 'address' => 'Synthetic campus address',
            'latitude' => 14.6, 'longitude' => 121.0, 'active' => true,
            'source_url' => 'https://example.test/campus', 'reference_note' => 'Synthetic reference for tests only.',
        ];
    }
}
