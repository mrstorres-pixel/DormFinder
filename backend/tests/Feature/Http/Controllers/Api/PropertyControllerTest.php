<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Property;
use App\Models\RoomOption;
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

    public function test_owner_search_sorting_and_pagination_never_include_another_owners_properties(): void
    {
        $landlord = User::factory()->landlord()->create();
        for ($number = 1; $number <= 26; $number++) {
            Property::factory()->for($landlord, 'landlord')->create(['title' => sprintf('Campus Residence %02d', $number), 'status' => 'draft']);
        }
        Property::factory()->create(['title' => 'Campus Residence 29', 'status' => 'draft']);

        $this->actingAs($landlord)->getJson('/api/v1/landlord/properties?view=active&status=draft&sort=title_asc&page=2')
            ->assertOk()->assertJsonPath('meta.total', 26)->assertJsonPath('meta.current_page', 2)
            ->assertJsonCount(12, 'data')->assertJsonPath('data.0.title', 'Campus Residence 13');
        $this->getJson('/api/v1/landlord/properties?view=active&q=Residence%202&sort=title_desc&per_page=24')
            ->assertOk()->assertJsonPath('meta.total', 7)->assertJsonPath('meta.per_page', 24)
            ->assertJsonPath('data.0.title', 'Campus Residence 26');
    }

    public function test_property_search_matches_address_and_city_and_treats_wildcards_literally(): void
    {
        $landlord = User::factory()->landlord()->create();
        $literal = Property::factory()->for($landlord, 'landlord')->create(['title' => '100% Occupied', 'address' => 'Mendiola Street', 'city' => 'Malolos']);
        Property::factory()->for($landlord, 'landlord')->create(['title' => '1000 Occupied', 'address' => 'Other Street', 'city' => 'Manila']);

        foreach (['q=%25', 'q=mendiola', 'q=MALOLOS'] as $filter) {
            $this->actingAs($landlord)->getJson('/api/v1/landlord/properties?'.$filter)
                ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $literal->id);
        }
    }

    public function test_property_views_and_status_filters_remain_independent_of_public_visibility(): void
    {
        $landlord = User::factory()->landlord()->create();
        foreach (['draft', 'approved', 'pending_review', 'archived'] as $status) {
            Property::factory()->for($landlord, 'landlord')->create(['status' => $status]);
        }
        $this->actingAs($landlord)->getJson('/api/v1/landlord/properties?view=active')->assertOk()->assertJsonPath('meta.total', 3);
        $this->getJson('/api/v1/landlord/properties?view=archived')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'archived');
        $this->getJson('/api/v1/landlord/properties?view=all&status=pending_review')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'pending_review');
    }

    public function test_availability_attention_and_taken_views_match_the_owners_actual_room_options(): void
    {
        $this->travelTo(now()->startOfSecond());
        $landlord = User::factory()->landlord()->create();
        foreach ([0, 14, 31] as $age) {
            $property = Property::factory()->for($landlord, 'landlord')->create(['status' => 'approved']);
            RoomOption::factory()->for($property)->create(['availability_confirmed_at' => now()->subDays($age)]);
        }
        $taken = Property::factory()->for($landlord, 'landlord')->create(['status' => 'approved']);
        RoomOption::factory()->for($taken)->create(['available_units' => 0]);
        $mixed = Property::factory()->for($landlord, 'landlord')->create(['status' => 'approved']);
        RoomOption::factory()->for($mixed)->create(['available_units' => 0]);
        RoomOption::factory()->for($mixed)->create(['available_units' => 1]);
        $foreign = Property::factory()->create(['status' => 'approved']);
        RoomOption::factory()->for($foreign)->create(['availability_confirmed_at' => now()->subDays(31)]);
        $draft = Property::factory()->for($landlord, 'landlord')->create(['status' => 'draft']);
        RoomOption::factory()->for($draft)->create(['availability_confirmed_at' => now()->subDays(31)]);

        $this->actingAs($landlord)->getJson('/api/v1/landlord/properties?availability=needs_confirmation')
            ->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.stale_listings', 2);
        $this->getJson('/api/v1/landlord/properties?availability=taken')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $taken->id);
    }

    public function test_property_filters_reject_invalid_values_and_cannot_grant_student_access(): void
    {
        $landlord = User::factory()->landlord()->create();
        foreach (['per_page=10000', 'page=0', 'status=published', 'availability=unknown', 'sort=unsafe', 'q[]=bad'] as $filter) {
            $this->actingAs($landlord)->getJson('/api/v1/landlord/properties?'.$filter)->assertUnprocessable();
        }
        $this->actingAs(User::factory()->create())->getJson('/api/v1/landlord/properties?q=Manila')->assertForbidden();
    }
}
