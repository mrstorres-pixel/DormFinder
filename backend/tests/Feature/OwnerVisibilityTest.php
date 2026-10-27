<?php

namespace Tests\Feature;

use App\Models\Inquiry;
use App\Models\Property;
use App\Models\RoomOption;
use App\Models\User;
use App\Models\ViewingRequest;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class OwnerVisibilityTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(array $values = []): Property
    {
        $property = Property::factory()->create([...['status' => 'approved', 'approved_at' => now()], ...$values]);
        RoomOption::factory()->for($property)->create(['total_units' => 4, 'available_units' => 2, 'availability_confirmed_at' => now()]);

        return $property;
    }

    public function test_pause_hides_public_advertising_without_removing_approval_inventory_or_conversations(): void
    {
        $property = $this->listing();
        $inquiry = Inquiry::factory()->for($property)->create();
        $this->actingAs($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/visibility', ['action' => 'pause', 'revision' => 1])->assertOk()->assertJsonPath('data.owner_paused', true)->assertJsonPath('data.status', 'approved')->assertJsonPath('data.revision', 2);
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings-map')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        $this->assertDatabaseHas('room_options', ['property_id' => $property->id, 'available_units' => 2]);
        $this->getJson('/api/v1/inquiries/'.$inquiry->id)->assertOk()->assertJsonPath('data.can_reply', true)->assertJsonPath('data.listing_available', false);
        $this->assertDatabaseHas('moderation_actions', ['property_id' => $property->id, 'action' => 'listing_pause']);
    }

    public function test_resume_requires_all_current_counts_and_a_real_vacancy_and_confirms_them_atomically(): void
    {
        $property = $this->listing(['owner_paused' => true]);
        $first = $property->roomOptions()->first();
        $second = RoomOption::factory()->for($property)->create(['name' => 'Second room', 'total_units' => 2, 'available_units' => 0, 'availability_confirmed_at' => now()->subDays(40)]);
        $this->actingAs($property->landlord);
        $url = '/api/v1/landlord/properties/'.$property->id.'/availability';
        $this->patchJson($url, ['resume' => true, 'revision' => 1, 'options' => [['id' => $first->id, 'available_units' => 1]]])->assertUnprocessable();
        $options = [['id' => $first->id, 'available_units' => 0], ['id' => $second->id, 'available_units' => 0]];
        $this->patchJson($url, ['resume' => true, 'revision' => 1, 'options' => $options])->assertUnprocessable();
        $options[1]['available_units'] = 3;
        $this->patchJson($url, ['resume' => true, 'revision' => 1, 'options' => $options])->assertUnprocessable();
        $this->assertTrue($property->fresh()->owner_paused);
        $this->assertSame(2, $first->fresh()->available_units);
        $options[1]['available_units'] = 1;
        $this->patchJson($url, ['resume' => true, 'revision' => 1, 'options' => $options])->assertOk()->assertJsonPath('data.owner_paused', false)->assertJsonPath('data.status', 'approved');
        $this->assertTrue($second->fresh()->availability_confirmed_at->isToday());
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_confirming_vacancies_while_paused_does_not_resume_advertising(): void
    {
        $property = $this->listing(['owner_paused' => true]);
        $option = $property->roomOptions()->first();
        $this->actingAs($property->landlord);
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', ['revision' => 1, 'options' => [['id' => $option->id, 'available_units' => 1]]])->assertOk()->assertJsonPath('data.owner_paused', true);
    }

    public function test_fully_occupied_is_hidden_from_discovery_but_keeps_a_readable_public_detail_and_history(): void
    {
        $property = $this->listing();
        $property->roomOptions()->update(['available_units' => 0]);
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings-map')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings/'.$property->id)->assertOk()->assertJsonPath('data.room_options.0.available_units', 0);
        $this->actingAs($property->landlord);
        $this->getJson('/api/v1/landlord/properties?owner_state=taken')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/landlord/properties?view=attention')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_visibility_is_owner_only_revision_checked_and_cannot_bypass_review(): void
    {
        $property = $this->listing();
        $this->actingAs(User::factory()->create(['role' => 'landlord']));
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/visibility', ['action' => 'pause', 'revision' => 1])->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->actingAs($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/visibility', ['action' => 'pause', 'revision' => 7])->assertConflict();
        $property->forceFill(['status' => 'pending_review'])->save();
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/visibility', ['action' => 'pause', 'revision' => 1])->assertConflict();
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', ['resume' => true, 'revision' => 1, 'options' => [['id' => $property->roomOptions()->first()->id, 'available_units' => 1]]])->assertConflict();
        $this->assertDatabaseCount('moderation_actions', 0);
    }

    public function test_existing_viewing_requests_remain_actionable_while_advertising_is_paused(): void
    {
        $property = $this->listing(['owner_paused' => true]);
        $viewing = ViewingRequest::factory()->create(['property_id' => $property->id, 'landlord_id' => $property->landlord_id, 'room_option_id' => $property->roomOptions()->first()->id, 'status' => 'requested', 'starts_at' => now()->addDay()]);
        $this->actingAs($property->landlord);
        $this->getJson('/api/v1/viewings')->assertOk()->assertJsonPath('data.0.id', $viewing->id)->assertJsonPath('data.0.can_schedule', true)->assertJsonPath('data.0.property_preview', null);
        $this->assertDatabaseHas('viewing_requests', ['id' => $viewing->id, 'status' => 'requested']);
    }
}
