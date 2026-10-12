<?php

namespace Database\Factories;

use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ViewingRequestFactory extends Factory
{
    public function definition(): array
    {
        return ['property_id' => Property::factory(), 'student_id' => User::factory(), 'landlord_id' => fn (array $attributes): int => Property::query()->findOrFail($attributes['property_id'])->landlord_id, 'client_id' => (string) Str::uuid(), 'listing_snapshot' => ['title' => 'Synthetic viewing', 'room_name' => 'Shared beds'], 'requested_start' => now()->addDays(2), 'starts_at' => now()->addDays(2), 'status' => 'requested', 'student_note' => '', 'owner_note' => '', 'revision' => 1];
    }
}
