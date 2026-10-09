<?php

namespace Database\Factories;

use App\Models\Property;
use App\Models\PropertyPhoto;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PropertyPhoto> */
class PropertyPhotoFactory extends Factory
{
    public function definition(): array
    {
        return [
            'property_id' => Property::factory(),
            'upload_id' => fake()->uuid(),
            'disk' => 'local',
            'storage_key' => 'test-photos/'.fake()->uuid().'.jpg',
            'caption' => 'Test room',
            'status' => 'ready',
        ];
    }
}
