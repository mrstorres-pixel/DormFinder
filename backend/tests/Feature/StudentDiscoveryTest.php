<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Property;
use App\Models\PropertyPhoto;
use App\Models\RoomOption;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class StudentDiscoveryTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(array $attributes = [], array $options = []): Property
    {
        $property = Property::factory()->create([...['status' => 'approved', 'approved_at' => now(), 'latitude' => 14.5953363, 'longitude' => 120.9881329], ...$attributes]);
        RoomOption::factory()->for($property)->create($options);

        return $property;
    }

    public function test_recommendations_respect_same_option_budget_and_selected_campus_radius(): void
    {
        $campus = Campus::query()->firstOrFail();
        $fresh = $this->listing([], ['monthly_rent_centavos' => 300000]);
        $stale = $this->listing(['latitude' => 14.596], ['availability_confirmed_at' => now()->subDays(15)]);
        $wrong = $this->listing([], ['available_units' => 0, 'monthly_rent_centavos' => 100000]);
        RoomOption::factory()->for($wrong)->create(['inventory_type' => 'whole_room', 'price_basis' => 'per_room', 'monthly_rent_centavos' => 200000]);
        $this->listing(['latitude' => 14.7]);
        $url = '/api/v1/listings?campus_id='.$campus->id.'&radius_km=2&sort=recommended&inventory_type=bedspace&price_basis=per_person&max_rent_centavos=400000';
        $this->getJson($url.'&available_only=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $fresh->id);
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.id', $fresh->id);
        $this->getJson('/api/v1/listings?radius_km=2')->assertUnprocessable()->assertJsonValidationErrors('campus_id');
        $this->getJson('/api/v1/listings?campus_id='.$campus->id.'&radius_km=100')->assertUnprocessable();
        $this->assertNotSame($stale->id, $fresh->id);
    }

    public function test_amenities_are_and_matched_and_missing_information_is_not_invented(): void
    {
        $both = $this->listing(['amenities' => ['wifi', 'laundry'], 'house_rules' => 'Quiet hours after 10 pm.']);
        $this->listing(['amenities' => ['wifi']]);
        $missing = $this->listing();
        $this->getJson('/api/v1/listings?amenities[]=wifi&amenities[]=laundry')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $both->id);
        $this->getJson('/api/v1/listings/'.$missing->id)->assertJsonPath('data.amenities', null);
        $this->getJson('/api/v1/listings?amenities[]=invented')->assertUnprocessable();
    }

    public function test_map_bounds_cover_more_than_one_page_and_preserve_visibility(): void
    {
        for ($i = 0; $i < 13; $i++) {
            $this->listing();
        }
        $this->listing(['status' => 'draft']);
        $this->listing(['latitude' => 15]);
        $url = '/api/v1/listings-map?south=14.59&north=14.60&west=120.98&east=121.00';
        $this->getJson($url)->assertOk()->assertJsonCount(13, 'data')->assertJsonPath('meta.total', 13)->assertJsonPath('meta.limited', false)->assertJsonMissingPath('data.0.landlord_id');
        $this->getJson('/api/v1/listings-map?south=15&north=14&west=120&east=121')->assertUnprocessable();
        $this->getJson('/api/v1/listings-map?south=14')->assertUnprocessable();
    }

    public function test_guests_can_compare_public_options_but_not_private_records(): void
    {
        $property = $this->listing();
        $selections = [['property_id' => $property->id, 'room_option_id' => $property->roomOptions()->first()->id]];
        $this->postJson('/api/v1/compare', ['selections' => $selections])->assertOk()->assertJsonMissingPath('data.0.landlord_id');
        $property->forceFill(['status' => 'draft'])->save();
        $this->postJson('/api/v1/compare', ['selections' => $selections])->assertUnprocessable();
    }

    public function test_vacancy_updates_are_audited_and_do_not_demote_but_reject_stale_foreign_or_excess_inventory(): void
    {
        $property = $this->listing();
        $option = $property->roomOptions()->first();
        $payload = ['revision' => 1, 'options' => [['id' => $option->id, 'available_units' => 1]]];
        $this->actingAs($property->landlord)->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', $payload)->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.revision', 2);
        $this->assertDatabaseHas('moderation_actions', ['property_id' => $property->id, 'action' => 'availability_update']);
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', $payload)->assertConflict();
        $payload['revision'] = 2;
        $payload['options'][0]['available_units'] = 99;
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', $payload)->assertUnprocessable();
        $this->assertDatabaseHas('room_options', ['id' => $option->id, 'available_units' => 1]);
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->landlord()->create())->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', $payload)->assertNotFound();
    }

    public function test_students_can_save_only_an_active_campus_and_other_roles_cannot_set_preferences(): void
    {
        $campus = Campus::query()->firstOrFail();
        $this->actingAs(User::factory()->create())->patchJson('/api/v1/me', ['name' => 'Student', 'preferred_campus_id' => $campus->id])->assertOk()->assertJsonPath('data.preferred_campus_id', $campus->id);
        $campus->forceFill(['active' => false])->save();
        $this->patchJson('/api/v1/me', ['name' => 'Student', 'preferred_campus_id' => $campus->id])->assertUnprocessable();
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->landlord()->create())->patchJson('/api/v1/me', ['name' => 'Owner', 'preferred_campus_id' => $campus->id])->assertUnprocessable();
    }

    public function test_photo_order_is_owner_only_complete_and_returns_material_edits_to_review(): void
    {
        $property = $this->listing();
        $first = PropertyPhoto::factory()->for($property)->create(['sort_order' => 0]);
        $second = PropertyPhoto::factory()->for($property)->create(['sort_order' => 1]);
        $url = '/api/v1/landlord/properties/'.$property->id.'/photos/order';
        $payload = ['revision' => 1, 'photo_ids' => [$second->id, $first->id]];
        $this->actingAs($property->landlord)->putJson($url, ['revision' => 1, 'photo_ids' => [$first->id]])->assertUnprocessable();
        $this->putJson($url, $payload)->assertOk()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.photos.0.id', $second->id);
        $this->putJson($url, $payload)->assertConflict();
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->landlord()->create())->putJson($url, ['revision' => 2, 'photo_ids' => [$first->id, $second->id]])->assertNotFound();
    }

    public function test_full_length_listing_title_can_be_reported(): void
    {
        $property = $this->listing(['title' => str_repeat('A', 150)]);
        $this->actingAs(User::factory()->create())->postJson('/api/v1/listings/'.$property->id.'/reports', ['client_id' => (string) Str::uuid(), 'category' => 'other', 'body' => 'Please verify these sample details.'])->assertCreated();
        $this->assertDatabaseHas('listing_reports', ['listing_title' => $property->title]);
    }

    public function test_campus_directory_is_opt_in_idempotent_and_preserves_existing_coordinates(): void
    {
        $campus = Campus::query()->firstOrFail();
        $before = $campus->latitude;
        $this->artisan('dormfinder:campuses')->assertSuccessful();
        $this->assertDatabaseCount('campuses', 1);
        $this->artisan('dormfinder:campuses', ['--apply' => true])->assertSuccessful();
        $count = DB::table('campuses')->count();
        $this->assertGreaterThan(1, $count);
        $this->artisan('dormfinder:campuses', ['--apply' => true])->assertSuccessful();
        $this->assertDatabaseCount('campuses', $count);
        $this->assertSame($before, $campus->fresh()->latitude);
        $this->getJson('/api/v1/campuses')->assertOk()->assertJsonFragment(['institution_name' => 'University of Santo Tomas']);
        $ceu = Campus::query()->where('institution_name', 'Centro Escolar University')->get();
        $this->assertCount(4, $ceu);
        $this->assertCount(4, $ceu->pluck('slug')->unique());
        $this->assertCount(4, $ceu->map(fn (Campus $row): string => $row->latitude.','.$row->longitude)->unique());
        $this->assertDatabaseHas('campuses', ['slug' => 'tip-quezon-city', 'city' => 'Quezon City']);
    }
}
