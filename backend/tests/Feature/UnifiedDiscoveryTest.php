<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\RoomOption;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class UnifiedDiscoveryTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(array $attributes = [], array $options = []): Property
    {
        $property = Property::factory()->create(['status' => 'approved', 'approved_at' => now(), ...$attributes]);
        RoomOption::factory()->for($property)->create($options);

        return $property;
    }

    public function test_suggestions_and_text_search_only_include_visible_public_listings(): void
    {
        $visible = $this->listing(['title' => 'Sampaloc Study House', 'city' => 'Manila', 'address' => 'Sampaloc sample street']);
        $this->listing(['title' => 'Sampaloc private draft', 'status' => 'draft']);
        $this->listing(['title' => 'Sampaloc expired'], ['availability_confirmed_at' => now()->subDays(31)]);
        $this->listing(['title' => 'Sampaloc suspended owner', 'landlord_id' => User::factory()->landlord()->create(['status' => 'suspended'])->id]);
        $this->getJson('/api/v1/search-suggestions?q=Sampaloc')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id)->assertJsonPath('data.0.kind', 'Listing')->assertJsonMissingPath('data.0.landlord_id');
        $this->getJson('/api/v1/listings?q=Study%20House')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $visible->id)->assertJsonMissingPath('data.0.distance_from_campus');
        $this->getJson('/api/v1/listings?q=Sampaloc%20sample')->assertOk()->assertJsonPath('data.0.id', $visible->id);
        $this->getJson('/api/v1/search-suggestions?q=Manila')->assertOk()->assertJsonPath('data.0.kind', 'Location')->assertJsonPath('data.0.label', 'Manila');
        $this->getJson('/api/v1/search-suggestions?q=%25')->assertUnprocessable();
        $this->getJson('/api/v1/search-suggestions?q=%25%25')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/search-suggestions?q='.str_repeat('a', 101))->assertUnprocessable();
    }

    public function test_owner_can_remove_a_listing_from_active_properties_and_find_it_under_removed(): void
    {
        $property = $this->listing();
        $other = $this->listing();
        $this->actingAs($other->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/lifecycle', ['action' => 'archive', 'revision' => 1, 'reason' => 'Remove this property from active listings.'])->assertNotFound();
        $this->actingAs($property->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/lifecycle', ['action' => 'archive', 'revision' => 1, 'reason' => 'Remove this property from active listings.'])->assertOk()->assertJsonPath('data.status', 'archived');
        $this->getJson('/api/v1/landlord/properties?view=active')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/landlord/properties?view=archived')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $property->id);
        $this->getJson('/api/v1/landlord/properties?view=invalid')->assertUnprocessable();
        $this->assertDatabaseHas('properties', ['id' => $property->id, 'status' => 'archived']);
        $this->assertDatabaseHas('room_options', ['property_id' => $property->id]);
    }
}
