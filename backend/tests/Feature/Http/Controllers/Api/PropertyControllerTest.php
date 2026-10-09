<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class PropertyControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_creates_a_draft_owned_by_the_logged_in_landlord(): void
    {
        $landlord = User::factory()->landlord()->create();

        $response = $this->actingAs($landlord)->postJson('/api/v1/landlord/properties', [
            'title' => 'Casal Demo Rooms', 'property_type' => 'rental_room', 'city' => 'Manila',
        ]);

        $response->assertCreated()->assertJsonPath('data.status', 'draft');
        $this->assertDatabaseHas('properties', ['id' => $response->json('data.id'), 'landlord_id' => $landlord->id]);
    }

    public function test_students_cannot_create_properties(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/v1/landlord/properties', [
            'title' => 'Student Property', 'property_type' => 'apartment', 'city' => 'Manila',
        ])->assertForbidden();
        $this->assertDatabaseCount('properties', 0);
    }

    public function test_rejects_owner_and_status_injection(): void
    {
        $this->actingAs(User::factory()->landlord()->create())->postJson('/api/v1/landlord/properties', [
            'title' => 'Injection', 'property_type' => 'apartment', 'city' => 'Manila',
            'landlord_id' => 123, 'status' => 'approved',
        ])->assertUnprocessable()->assertJsonValidationErrors(['landlord_id', 'status']);
        $this->assertDatabaseCount('properties', 0);
    }

    public function test_other_landlord_receives_404_for_a_private_draft(): void
    {
        $property = Property::factory()->create();

        $this->actingAs(User::factory()->landlord()->create())
            ->getJson('/api/v1/landlord/properties/'.$property->id)->assertNotFound();
    }

    public function test_only_own_properties_appear_in_dashboard(): void
    {
        $landlord = User::factory()->landlord()->create();
        $own = Property::factory()->for($landlord, 'landlord')->create();
        Property::factory()->create();

        $this->actingAs($landlord)->getJson('/api/v1/landlord/properties')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own->id);
    }

    public function test_stale_revision_returns_409_without_overwriting(): void
    {
        $property = Property::factory()->create(['revision' => 2]);

        $this->actingAs($property->landlord)->patchJson('/api/v1/landlord/properties/'.$property->id, [
            'title' => 'Overwritten', 'property_type' => 'apartment', 'city' => 'Manila', 'revision' => 1,
        ])->assertConflict();
        $this->assertSame($property->title, $property->fresh()->title);
    }

    public function test_material_update_returns_approved_property_to_draft(): void
    {
        $property = Property::factory()->create(['status' => 'approved', 'approved_at' => now()]);

        $this->actingAs($property->landlord)->patchJson('/api/v1/landlord/properties/'.$property->id, [
            'title' => 'Updated title', 'property_type' => 'apartment', 'city' => 'Manila', 'revision' => 1,
        ])->assertOk()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.revision', 2);
        $this->assertNull($property->fresh()->approved_at);
    }
}
