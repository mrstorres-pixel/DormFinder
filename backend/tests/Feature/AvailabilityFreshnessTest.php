<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\RoomOption;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class AvailabilityFreshnessTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(int $age = 0): Property
    {
        $property = Property::factory()->create(['status' => 'approved', 'approved_at' => now(), 'latitude' => 14.59, 'longitude' => 120.99]);
        RoomOption::factory()->for($property)->create(['availability_confirmed_at' => now()->subDays($age)]);

        return $property;
    }

    private function become(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user);
    }

    public function test_room_age_is_explicit_and_thirty_day_expiry_applies_to_every_public_read(): void
    {
        $this->travelTo(now()->startOfSecond());
        $property = $this->listing();
        $option = $property->roomOptions()->first();
        $this->travel(14)->days();
        $this->getJson('/api/v1/listings/'.$property->id)->assertOk()->assertJsonPath('data.room_options.0.availability_age_days', 14)->assertJsonPath('data.room_options.0.availability_stale', true)->assertJsonPath('data.room_options.0.availability_expired', false);
        $this->travel(16)->days();
        $property->update(['title' => 'A recently edited title']);
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings-map')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        $second = $this->listing();
        $this->postJson('/api/v1/compare', ['selections' => [['property_id' => $property->id, 'room_option_id' => $option->id], ['property_id' => $second->id, 'room_option_id' => $second->roomOptions()->first()->id]]])->assertUnprocessable();
        Http::preventStrayRequests();
        $this->getJson('/api/v1/listings/'.$property->id.'/walking-route?campus_id=1')->assertNotFound();
        Http::assertNothingSent();
        $this->assertDatabaseHas('properties', ['id' => $property->id, 'status' => 'approved']);
    }

    public function test_expired_room_cannot_supply_a_cheap_price_when_another_room_is_current(): void
    {
        $property = $this->listing(30);
        $expired = $property->roomOptions()->first();
        $expired->update(['monthly_rent_centavos' => 100000]);
        $current = RoomOption::factory()->for($property)->create(['monthly_rent_centavos' => 900000]);
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonCount(1, 'data')->assertJsonCount(1, 'data.0.room_options')->assertJsonPath('data.0.room_options.0.id', $current->id);
        $this->getJson('/api/v1/listings?price_basis=per_person&max_rent_centavos=200000')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings/'.$property->id)->assertOk()->assertJsonCount(1, 'data.room_options');
        $second = $this->listing();
        $this->postJson('/api/v1/compare', ['selections' => [['property_id' => $property->id, 'room_option_id' => $expired->id], ['property_id' => $second->id, 'room_option_id' => $second->roomOptions()->first()->id]]])->assertUnprocessable();
    }

    public function test_owner_reminders_are_private_deduplicated_and_progress_from_due_to_warning_to_hidden(): void
    {
        $this->travelTo(now()->startOfSecond());
        $property = $this->listing(13);
        $this->become($property->landlord);
        $this->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->travel(1)->days();
        $this->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->getJson('/api/v1/notifications')->assertOk()->assertJsonPath('data.0.kind', 'availability')->assertJsonPath('data.0.path', '/landlord/properties/'.$property->id.'#rooms');
        $this->getJson('/api/v1/landlord/properties')->assertOk()->assertJsonPath('data.0.availability.status', 'needs_confirmation');
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 1);
        $this->travel(13)->days();
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 2);
        $this->travel(3)->days();
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 3);
        $this->getJson('/api/v1/landlord/properties/'.$property->id)->assertOk()->assertJsonPath('data.availability.status', 'hidden');
        $this->become(User::factory()->landlord()->create());
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 0);
        $this->getJson('/api/v1/landlord/properties/'.$property->id)->assertNotFound();
    }

    public function test_reconfirmation_restores_approved_listing_without_resetting_review_and_resolves_reminders(): void
    {
        $property = $this->listing(31);
        $approved = $property->approved_at;
        $option = $property->roomOptions()->first();
        $this->become($property->landlord);
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 1);
        $payload = ['revision' => 1, 'options' => [['id' => $option->id, 'available_units' => 2]]];
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', $payload)->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.revision', 2)->assertJsonPath('data.availability.status', 'current')->assertJsonPath('data.room_options.0.availability_age_days', 0);
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 0);
        $this->getJson('/api/v1/listings/'.$property->id)->assertOk();
        $this->assertTrue($approved->equalTo($property->fresh()->approved_at));
        $this->assertDatabaseHas('moderation_actions', ['property_id' => $property->id, 'action' => 'availability_update']);
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', $payload)->assertConflict();
        foreach (['draft', 'suspended', 'archived'] as $status) {
            $property->forceFill(['status' => $status])->save();
            $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/availability', ['revision' => 2, 'options' => $payload['options']])->assertConflict();
            $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        }
    }

    public function test_long_titles_and_returning_after_the_deadline_generate_one_current_reminder(): void
    {
        $property = $this->listing(32);
        $property->update(['title' => str_repeat('A', 150)]);
        $this->become($property->landlord);
        $this->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 1);
        $notice = $this->getJson('/api/v1/notifications')->assertOk()->json('data.0');
        $this->assertLessThanOrEqual(160, mb_strlen($notice['title']));
        $this->assertStringStartsWith('Listing hidden:', $notice['title']);
        $this->putJson('/api/v1/notifications/'.$notice['id'].'/read')->assertOk();
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unread_count', 0);
    }

    public function test_expiry_preserves_private_history_but_blocks_new_contact_and_scheduling(): void
    {
        $property = $this->listing();
        $option = $property->roomOptions()->first();
        $student = User::factory()->create();
        $this->become($student);
        $this->putJson('/api/v1/favorites/'.$property->id)->assertSuccessful();
        $thread = $this->postJson('/api/v1/listings/'.$property->id.'/inquiries', ['room_option_id' => $option->id, 'body' => 'Is this room still available?', 'client_id' => (string) Str::uuid()])->assertCreated()->json('data.id');
        $visit = $this->postJson('/api/v1/listings/'.$property->id.'/viewings', ['room_option_id' => $option->id, 'client_id' => (string) Str::uuid(), 'starts_at' => now()->addDays(40)->toIso8601String()])->assertCreated()->json('data.id');
        $this->travel(30)->days();
        $this->getJson('/api/v1/inquiries/'.$thread)->assertOk()->assertJsonPath('data.can_reply', true)->assertJsonPath('data.listing_available', false);
        $this->postJson('/api/v1/inquiries/'.$thread.'/messages', ['body' => 'Can you refresh your availability?', 'client_id' => (string) Str::uuid()])->assertCreated();
        $this->getJson('/api/v1/viewings')->assertOk()->assertJsonPath('data.0.can_schedule', false);
        $this->getJson('/api/v1/saved-places')->assertOk()->assertJsonPath('data.0.listing', null);
        $this->postJson('/api/v1/listings/'.$property->id.'/inquiries', ['room_option_id' => $option->id, 'body' => 'New contact', 'client_id' => (string) Str::uuid()])->assertNotFound();
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', ['room_option_id' => $option->id, 'client_id' => (string) Str::uuid(), 'starts_at' => now()->addDay()->toIso8601String()])->assertNotFound();
        $this->patchJson('/api/v1/viewings/'.$visit, ['revision' => 1, 'action' => 'cancel'])->assertOk();
        $this->assertDatabaseHas('favorites', ['student_id' => $student->id, 'property_id' => $property->id]);
        $this->assertDatabaseHas('inquiries', ['id' => $thread]);
        $this->assertDatabaseHas('viewing_requests', ['id' => $visit, 'status' => 'cancelled']);
    }
}
