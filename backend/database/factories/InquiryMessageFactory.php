<?php

namespace Database\Factories;

use App\Models\Inquiry;
use App\Models\InquiryMessage;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<InquiryMessage> */
class InquiryMessageFactory extends Factory
{
    public function definition(): array
    {
        return ['inquiry_id' => Inquiry::factory(), 'sender_id' => fn (array $values) => Inquiry::findOrFail($values['inquiry_id'])->student_id, 'client_id' => fake()->uuid(), 'body' => 'Synthetic inquiry message.'];
    }
}
