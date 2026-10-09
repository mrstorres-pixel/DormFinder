<?php

namespace Database\Factories;

use App\Models\ListingReview;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ListingReview> */
class ListingReviewFactory extends Factory
{
    public function definition(): array
    {
        return ['property_id' => Property::factory(), 'administrator_id' => User::factory()->state(['role' => 'admin']), 'revision' => 1, 'decision' => 'approved'];
    }
}
