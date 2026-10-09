<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Property;
use App\Models\RoomOption;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PhaseThreeTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(array $attributes = [], array $option = []): Property
    {
        $property = Property::factory()->create(array_merge(['status' => 'approved', 'approved_at' => now(), 'latitude' => 14.5953363, 'longitude' => 120.9881329], $attributes));
        RoomOption::factory()->for($property)->create($option);

        return $property;
    }

    private function become(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user);
    }

    public function test_budget_and_availability_must_match_the_same_live_room_option(): void
    {
        $wrong = $this->listing(['title' => 'Cheap sold out'], ['available_units' => 0, 'monthly_rent_centavos' => 200000]);
        RoomOption::factory()->for($wrong)->create(['monthly_rent_centavos' => 800000]);
        $right = $this->listing(['title' => 'Matching beds'], ['monthly_rent_centavos' => 300001]);
        RoomOption::factory()->for($right)->create(['monthly_rent_centavos' => 999000]);
        $this->listing([], ['monthly_rent_centavos' => 100000, 'availability_confirmed_at' => now()->subDays(15)]);
        $this->listing([], ['monthly_rent_centavos' => 100000])->roomOptions()->first()->delete();
        $this->listing([], ['inventory_type' => 'whole_room', 'price_basis' => 'per_room', 'monthly_rent_centavos' => 300000]);
        $this->getJson('/api/v1/listings?price_basis=per_person&max_rent_centavos=400000&available_only=1')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $right->id)
            ->assertJsonCount(1, 'data.0.room_options')->assertJsonPath('data.0.room_options.0.monthly_rent_centavos', 300001);
    }

    public function test_price_boundaries_are_inclusive_and_bad_filters_are_rejected(): void
    {
        $this->listing([], ['monthly_rent_centavos' => 350029]);
        $this->getJson('/api/v1/listings?price_basis=per_person&min_rent_centavos=350029&max_rent_centavos=350029')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/listings?max_rent_centavos=500000')->assertUnprocessable()->assertJsonValidationErrors('price_basis');
        $this->getJson('/api/v1/listings?price_basis=per_person&min_rent_centavos=500000&max_rent_centavos=300000')->assertUnprocessable();
        $this->getJson('/api/v1/listings?sort=rent_asc')->assertUnprocessable();
        $this->getJson('/api/v1/listings?sort=rent_asc%3BDROP%20TABLE%20users')->assertUnprocessable();
        $this->getJson('/api/v1/listings?available_only=maybe')->assertUnprocessable();
        $this->getJson('/api/v1/listings?max_rent_centavos=1.2')->assertUnprocessable();
    }

    public function test_price_sort_uses_matching_options_and_stable_ties_across_pages(): void
    {
        $ids = [];
        for ($index = 0; $index < 14; $index++) {
            $listing = $this->listing([], ['monthly_rent_centavos' => 300000]);
            $ids[] = $listing->id;
            RoomOption::factory()->for($listing)->create(['monthly_rent_centavos' => 100, 'available_units' => 0]);
        }
        $pageOne = $this->getJson('/api/v1/listings?price_basis=per_person&available_only=1&sort=rent_asc')->assertOk()->assertJsonPath('meta.total', 14)->assertJsonCount(12, 'data');
        $pageTwo = $this->getJson('/api/v1/listings?price_basis=per_person&available_only=1&sort=rent_asc&page=2')->assertOk()->assertJsonCount(2, 'data');
        $actual = array_merge(array_column($pageOne->json('data'), 'id'), array_column($pageTwo->json('data'), 'id'));
        $this->assertSame(array_reverse($ids), $actual);
        $expensive = $this->listing([], ['monthly_rent_centavos' => 900000]);
        $this->getJson('/api/v1/listings?price_basis=per_person&sort=rent_desc')->assertJsonPath('data.0.id', $expensive->id);
    }

    public function test_search_is_literal_and_filters_do_not_expose_unpublished_properties(): void
    {
        $match = $this->listing(['title' => '100% student_home', 'property_type' => 'apartment']);
        $this->listing(['title' => 'Other student home']);
        $this->listing(['title' => '100% student_home', 'status' => 'draft']);
        $suspended = $this->listing(['title' => '100% student_home']);
        $suspended->landlord->forceFill(['status' => 'suspended'])->save();
        $this->getJson('/api/v1/listings?q=100%25%20student_home&property_type=apartment')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $match->id)->assertJsonMissingPath('data.0.landlord_id');
        $this->getJson('/api/v1/listings?q=%27%20OR%201%3D1%20--')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_search_defaults_to_the_lowest_matching_room_price(): void
    {
        $property = $this->listing([], ['monthly_rent_centavos' => 800000]);
        $cheaper = RoomOption::factory()->for($property)->create(['monthly_rent_centavos' => 300000]);
        $this->getJson('/api/v1/listings?price_basis=per_person&sort=rent_asc')->assertOk()->assertJsonPath('data.0.room_options.0.id', $cheaper->id)->assertJsonPath('data.0.room_options.0.monthly_rent_centavos', 300000);
    }

    public function test_distances_use_the_selected_campus_and_missing_pins_sort_last(): void
    {
        $near = $this->listing();
        $far = $this->listing(['latitude' => 14.6053363]);
        $unknown = $this->listing(['latitude' => null, 'longitude' => null]);
        $result = $this->getJson('/api/v1/listings?sort=distance')->assertOk();
        $this->assertSame([$near->id, $far->id, $unknown->id], array_column($result->json('data'), 'id'));
        $this->assertSame(0, $result->json('data.0.distance_from_campus.meters'));
        $this->assertEqualsWithDelta(1112, $result->json('data.1.distance_from_campus.meters'), 2);
        $this->assertNull($result->json('data.2.distance_from_campus.meters'));
        $campus = Campus::factory()->create(['latitude' => $far->latitude, 'longitude' => $far->longitude]);
        $this->getJson('/api/v1/listings?sort=distance&campus_id='.$campus->id)->assertJsonPath('data.0.id', $far->id)->assertJsonPath('data.0.distance_from_campus.campus_id', $campus->id);
        $this->getJson('/api/v1/listings/'.$far->id.'?campus_id='.$campus->id)->assertJsonPath('data.distance_from_campus.meters', 0);
        $campus->forceFill(['active' => false])->save();
        $this->getJson('/api/v1/listings?campus_id='.$campus->id)->assertUnprocessable();
        $this->getJson('/api/v1/campuses')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', 'tip-manila-casal');
    }

    public function test_favorites_are_idempotent_private_and_student_only(): void
    {
        $property = $this->listing();
        $this->getJson('/api/v1/favorites')->assertUnauthorized();
        $student = User::factory()->create();
        $this->become($student);
        $this->putJson('/api/v1/favorites/'.$property->id)->assertOk();
        $this->putJson('/api/v1/favorites/'.$property->id)->assertOk();
        $this->assertDatabaseCount('favorites', 1);
        $this->getJson('/api/v1/favorites')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $property->id)->assertJsonMissingPath('data.0.landlord_id');
        $this->getJson('/api/v1/favorites/ids')->assertExactJson(['data' => [$property->id]]);
        $this->become(User::factory()->create());
        $this->getJson('/api/v1/favorites')->assertJsonCount(0, 'data');
        $this->deleteJson('/api/v1/favorites/'.$property->id)->assertOk();
        $this->assertDatabaseCount('favorites', 1);
        foreach ([User::factory()->landlord()->create(), User::factory()->create(['role' => 'admin'])] as $user) {
            $this->become($user);
            $this->getJson('/api/v1/favorites')->assertForbidden();
            $this->putJson('/api/v1/favorites/'.$property->id)->assertForbidden();
            $this->deleteJson('/api/v1/favorites/'.$property->id)->assertForbidden();
        }
    }

    public function test_hidden_favorites_remain_saved_without_disclosing_private_listing_details(): void
    {
        $property = $this->listing(['title' => 'Original public title']);
        $this->become(User::factory()->create());
        $this->putJson('/api/v1/favorites/'.$property->id)->assertOk();
        $property->forceFill(['status' => 'draft', 'title' => 'Private edited title'])->save();
        $this->getJson('/api/v1/favorites')->assertOk()->assertJsonCount(0, 'data')->assertDontSee('Private edited title')->assertJsonPath('meta.unavailable_ids', [$property->id]);
        $this->getJson('/api/v1/favorites/ids')->assertExactJson(['data' => [$property->id]]);
        $this->putJson('/api/v1/favorites/'.$property->id)->assertNotFound();
        $property->forceFill(['status' => 'approved'])->save();
        $this->getJson('/api/v1/favorites')->assertJsonCount(1, 'data');
        $property->forceFill(['status' => 'archived'])->save();
        $this->deleteJson('/api/v1/favorites/'.$property->id)->assertOk();
        $this->deleteJson('/api/v1/favorites/'.$property->id)->assertOk();
        $this->assertDatabaseCount('favorites', 0);
    }

    public function test_full_comparison_retains_selection_and_alternative_options_without_owner_details(): void
    {
        $property = $this->listing();
        $alternative = RoomOption::factory()->for($property)->create(['inventory_type' => 'whole_room', 'price_basis' => 'per_room']);
        $this->become(User::factory()->create());
        $this->postJson('/api/v1/compare', ['selections' => [['property_id' => $property->id, 'room_option_id' => $alternative->id]]])
            ->assertOk()->assertJsonPath('data.0.room_options.0.id', $alternative->id)->assertJsonCount(2, 'data.0.alternative_room_options')
            ->assertJsonPath('data.0.distance_from_campus.meters', 0)->assertJsonMissingPath('data.0.landlord_id');
        $property->forceFill(['status' => 'suspended'])->save();
        $this->postJson('/api/v1/compare', ['selections' => [['property_id' => $property->id, 'room_option_id' => $alternative->id]]])->assertUnprocessable();
    }

    public function test_readiness_requires_the_phase_three_migration(): void
    {
        $this->getJson('/api/v1/health')->assertOk()->assertJsonPath('data.phase', 3);
        DB::table('migrations')->where('migration', '2026_10_09_094508_create_phase_three_discovery_tables')->delete();
        $this->getJson('/api/v1/health')->assertStatus(503);
    }
}
