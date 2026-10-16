<?php

namespace Tests\Feature;

use App\Models\Inquiry;
use App\Models\Property;
use App\Models\RoomOption;
use App\Models\User;
use App\Models\ViewingRequest;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class PracticalHousingTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(): array
    {
        $owner = User::factory()->landlord()->create();
        $property = Property::factory()->for($owner, 'landlord')->create(['status' => 'approved', 'approved_at' => now()]);
        $room = RoomOption::factory()->for($property)->create();

        return [$owner, $property, $room];
    }

    private function login(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user);
    }

    private function requestView(Property $property, RoomOption $room, array $extra = []): array
    {
        $payload = ['client_id' => (string) Str::uuid(), 'room_option_id' => $room->id, 'starts_at' => now()->addDays(2)->startOfHour()->toIso8601String(), 'note' => 'Synthetic campus housing visit.'];
        $payload = [...$payload, ...$extra];
        $response = $this->postJson('/api/v1/listings/'.$property->id.'/viewings', $payload)->assertCreated()->assertJsonPath('data.status', 'requested')->assertJsonPath('data.revision', 1);

        return [$response->json('data'), $payload];
    }

    public function test_viewing_sections_filter_before_pagination_and_private_deep_links_keep_history(): void
    {
        [$owner, $property, $room] = $this->listing();
        $student = User::factory()->create();
        $attributes = ['student_id' => $student->id, 'landlord_id' => $owner->id, 'property_id' => $property->id, 'room_option_id' => $room->id];
        ViewingRequest::factory()->count(13)->create([...$attributes, 'status' => 'cancelled']);
        $future = ViewingRequest::factory()->create([...$attributes, 'status' => 'accepted', 'starts_at' => now()->addDays(2)]);
        $past = ViewingRequest::factory()->create([...$attributes, 'status' => 'accepted', 'starts_at' => now()->subDay()]);
        $pending = ViewingRequest::factory()->create([...$attributes, 'status' => 'proposed', 'starts_at' => now()->subHour()]);
        $this->login($student);
        $this->getJson('/api/v1/viewings?group=upcoming')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $future->id);
        $this->getJson('/api/v1/viewings?group=requests')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $pending->id);
        $this->getJson('/api/v1/viewings?group=history')->assertOk()->assertJsonPath('meta.total', 14)->assertJsonPath('meta.last_page', 2);
        $this->getJson('/api/v1/viewings?id='.$past->id)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.time_passed', true);
        $this->getJson('/api/v1/viewings?property_id='.$property->id.'&active=1')->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/viewings?group=invalid')->assertUnprocessable();
        $this->login(User::factory()->create());
        $this->getJson('/api/v1/viewings?id='.$past->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/viewings?property_id='.$property->id.'&active=1')->assertJsonCount(0, 'data');
    }

    public function test_viewing_context_only_exposes_published_images_and_the_participants_own_conversation(): void
    {
        Storage::fake('local');
        [$owner, $property, $room] = $this->listing();
        $this->login($student = User::factory()->create());
        [$view] = $this->requestView($property, $room);
        $conversation = Inquiry::factory()->create(['property_id' => $property->id, 'student_id' => $student->id, 'landlord_id' => $owner->id]);
        $this->getJson('/api/v1/viewings?id='.$view['id'])->assertOk()->assertJsonPath('data.0.conversation_id', $conversation->id)->assertJsonPath('data.0.property_preview.title', $property->title)->assertJsonPath('data.0.participant_avatar_url', $owner->avatarUrl());
        $this->get('/api/v1/avatars/'.$owner->id)->assertOk();
        $conversation->delete();
        $this->get('/api/v1/avatars/'.$owner->id)->assertOk();
        $property->forceFill(['status' => 'archived'])->save();
        $this->getJson('/api/v1/viewings?id='.$view['id'])->assertOk()->assertJsonPath('data.0.property_preview', null)->assertJsonPath('data.0.conversation_id', null)->assertJsonPath('data.0.listing_snapshot.title', $property->title)->assertJsonPath('data.0.can_schedule', false);
        $this->login(User::factory()->create());
        $this->get('/api/v1/avatars/'.$owner->id)->assertNotFound();
    }

    public function test_viewing_counterproposal_requires_student_confirmation_and_preserves_history(): void
    {
        [$owner,$property,$room] = $this->listing();
        $student = User::factory()->create();
        $this->login($student);
        [$view,$payload] = $this->requestView($property, $room);
        $stored = ViewingRequest::query()->findOrFail($view['id']);
        $this->assertSame($property->id, $stored->property_id);
        $this->assertSame($room->id, $stored->room_option_id);
        $this->assertSame($payload['note'], $stored->student_note);
        $this->assertTrue($stored->requested_start->equalTo(CarbonImmutable::parse($payload['starts_at'])));
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', $payload)->assertCreated()->assertJsonPath('data.id', $view['id']);
        $payload['note'] = 'Changed retry';
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', $payload)->assertConflict();
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'accept', 'revision' => 1])->assertForbidden();
        $this->login($owner);
        $time = now()->addDays(3)->startOfHour()->toIso8601String();
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'propose', 'revision' => 1, 'starts_at' => $time, 'note' => 'Please come at the revised time.'])->assertOk()->assertJsonPath('data.status', 'proposed')->assertJsonPath('data.revision', 2);
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'accept', 'revision' => 2])->assertForbidden();
        $this->login($student);
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'accept', 'revision' => 1])->assertConflict();
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'accept', 'revision' => 2])->assertOk()->assertJsonPath('data.status', 'accepted');
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.upcoming_viewings', 1);
        $property->forceFill(['status' => 'archived'])->save();
        $this->getJson('/api/v1/viewings')->assertOk()->assertJsonPath('data.0.listing_snapshot.title', $property->title)->assertJsonPath('data.0.can_schedule', false);
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'cancel', 'revision' => 3])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseCount('user_notifications', 4);
    }

    public function test_viewing_privacy_published_options_and_time_validation(): void
    {
        [$owner,$property,$room] = $this->listing();
        $student = User::factory()->create();
        $this->login($student);
        [$view] = $this->requestView($property, $room);
        $this->getJson('/api/v1/viewings')->assertJsonCount(1, 'data');
        $this->login(User::factory()->create());
        $this->getJson('/api/v1/viewings')->assertJsonCount(0, 'data');
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'cancel', 'revision' => 1])->assertNotFound();
        $this->login(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/v1/viewings')->assertForbidden();
        $this->patchJson('/api/v1/viewings/'.$view['id'], ['action' => 'cancel', 'revision' => 1])->assertNotFound();
        $this->login(User::factory()->create());
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', ['client_id' => (string) Str::uuid(), 'room_option_id' => $room->id, 'starts_at' => now()->subDay()->toIso8601String()])->assertUnprocessable();
        $foreign = RoomOption::factory()->create();
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', ['client_id' => (string) Str::uuid(), 'room_option_id' => $foreign->id, 'starts_at' => now()->addDay()->toIso8601String()])->assertNotFound();
        $room->update(['available_units' => 0]);
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', ['client_id' => (string) Str::uuid(), 'room_option_id' => $room->id, 'starts_at' => now()->addDay()->toIso8601String()])->assertConflict();
        $property->forceFill(['status' => 'draft'])->save();
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', ['client_id' => (string) Str::uuid(), 'room_option_id' => $room->id, 'starts_at' => now()->addDay()->toIso8601String()])->assertNotFound();
        $this->login($owner);
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', [])->assertForbidden();
    }

    public function test_only_one_active_request_and_overlapping_accepted_slots_are_rejected(): void
    {
        [$owner,$property,$room] = $this->listing();
        $student = User::factory()->create();
        $this->login($student);
        [$first] = $this->requestView($property, $room);
        $this->postJson('/api/v1/listings/'.$property->id.'/viewings', ['client_id' => (string) Str::uuid(), 'room_option_id' => $room->id, 'starts_at' => now()->addDays(4)->toIso8601String()])->assertConflict();
        $this->login($owner);
        $this->patchJson('/api/v1/viewings/'.$first['id'], ['action' => 'accept', 'revision' => 1])->assertOk();
        $this->login(User::factory()->create());
        [$second] = $this->requestView($property, $room);
        $this->login($owner);
        $this->patchJson('/api/v1/viewings/'.$second['id'], ['action' => 'accept', 'revision' => 1])->assertConflict();
        $this->patchJson('/api/v1/viewings/'.$second['id'], ['action' => 'propose', 'revision' => 1, 'starts_at' => now()->addDays(2)->startOfHour()->addHour()->toIso8601String()])->assertOk();
        $other = User::query()->findOrFail(ViewingRequest::query()->findOrFail($second['id'])->student_id);
        $this->login($other);
        $this->patchJson('/api/v1/viewings/'.$second['id'], ['action' => 'accept', 'revision' => 2])->assertOk();
    }

    public function test_shortlists_notes_and_room_choices_are_private_revision_checked_and_keep_unpublished_history(): void
    {
        [$owner,$property,$room] = $this->listing();
        $student = User::factory()->create();
        $this->login($student);
        $id = $this->postJson('/api/v1/shortlists', ['name' => 'Near my campus'])->assertCreated()->json('data.id');
        $this->getJson('/api/v1/shortlists')->assertJsonPath('data.0.name', 'Near my campus');
        $item = $this->postJson('/api/v1/shortlists/'.$id.'/items', ['property_id' => $property->id, 'room_option_id' => $room->id])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/shortlists/'.$id.'/items', ['property_id' => $property->id, 'room_option_id' => $room->id])->assertCreated()->assertJsonPath('data.id', $item);
        $this->patchJson('/api/v1/shortlists/'.$id.'/items/'.$item, ['revision' => 1, 'note' => 'Private student notes.'])->assertOk();
        $this->patchJson('/api/v1/shortlists/'.$id.'/items/'.$item, ['revision' => 1, 'note' => 'Stale notes'])->assertConflict();
        $this->getJson('/api/v1/shortlists/'.$id)->assertJsonPath('data.items.0.note', 'Private student notes.')->assertJsonPath('data.items.0.listing.id', $property->id);
        $property->forceFill(['status' => 'archived'])->save();
        $this->getJson('/api/v1/shortlists/'.$id)->assertJsonPath('data.items.0.listing', null)->assertJsonPath('data.items.0.listing_snapshot.title', $property->title);
        $this->patchJson('/api/v1/shortlists/'.$id.'/items/'.$item, ['revision' => 2, 'note' => ''])->assertOk();
        $this->login(User::factory()->create());
        $this->getJson('/api/v1/shortlists/'.$id)->assertNotFound();
        $this->patchJson('/api/v1/shortlists/'.$id.'/items/'.$item, ['revision' => 3, 'note' => 'Attack'])->assertNotFound();
        $this->deleteJson('/api/v1/shortlists/'.$id)->assertNotFound();
        $this->login($owner);
        $this->getJson('/api/v1/shortlists')->assertForbidden();
        $this->login($student);
        $this->deleteJson('/api/v1/shortlists/'.$id.'/items/'.$item, ['revision' => 2])->assertConflict();
        $this->deleteJson('/api/v1/shortlists/'.$id.'/items/'.$item, ['revision' => 3])->assertOk();
        $this->deleteJson('/api/v1/shortlists/'.$id)->assertOk();
        $this->assertDatabaseCount('shortlist_items', 0);
    }

    public function test_shortlist_foreign_options_and_limits_do_not_replace_existing_notes(): void
    {
        [$owner,$property,$room] = $this->listing();
        $this->login(User::factory()->create());
        $id = $this->postJson('/api/v1/shortlists', ['name' => 'Budget'])->json('data.id');
        $foreign = RoomOption::factory()->create();
        $this->postJson('/api/v1/shortlists/'.$id.'/items', ['property_id' => $property->id, 'room_option_id' => $foreign->id])->assertNotFound();
        $item = $this->postJson('/api/v1/shortlists/'.$id.'/items', ['property_id' => $property->id, 'room_option_id' => $room->id])->json('data.id');
        $other = RoomOption::factory()->for($property)->create();
        $this->patchJson('/api/v1/shortlists/'.$id.'/items/'.$item, ['revision' => 1, 'room_option_id' => $other->id, 'note' => 'Keep this note'])->assertOk();
        $this->postJson('/api/v1/shortlists/'.$id.'/items', ['property_id' => $property->id, 'room_option_id' => $room->id])->assertConflict();
        $this->assertDatabaseHas('shortlist_items', ['id' => $item, 'note' => 'Keep this note']);
        for ($i = 1; $i < 10; $i++) {
            $this->postJson('/api/v1/shortlists', ['name' => 'List '.$i])->assertCreated();
        }
        $this->postJson('/api/v1/shortlists', ['name' => 'Eleventh'])->assertUnprocessable();
    }
}
