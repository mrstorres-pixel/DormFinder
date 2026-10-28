<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Inquiry;
use App\Models\Property;
use App\Models\RoomOption;
use App\Models\User;
use App\Models\ViewingRequest;
use App\Services\ActivityRecorder;
use App\Services\ListingWorkflow;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LocationAndNotificationContextTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(array $attributes = []): Property
    {
        $property = Property::factory()->create([...['status' => 'approved', 'latitude' => 14.6, 'longitude' => 121], ...$attributes]);
        RoomOption::factory()->for($property)->create();

        return $property;
    }

    public function test_legacy_overseas_pins_are_flagged_without_changing_saved_work(): void
    {
        Http::fake();
        $bad = $this->listing(['latitude' => 60, 'longitude' => 30]);
        $good = $this->listing();
        $before = $bad->fresh()->getRawOriginal();
        $campus = Campus::factory()->create();
        $this->getJson('/api/v1/listings/'.$bad->id)->assertOk()->assertJsonPath('data.location_check.status', 'needs_correction')->assertJsonPath('data.latitude', null);
        $this->getJson('/api/v1/listings-map')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('meta.mapped_total', 1)->assertJsonPath('meta.unmapped_count', 1)->assertJsonPath('data.0.id', $good->id);
        $this->getJson('/api/v1/listings/'.$bad->id.'/walking-route?campus_id='.$campus->id)->assertUnprocessable();
        Http::assertNothingSent();
        $this->actingAs($bad->landlord)->getJson('/api/v1/landlord/properties?owner_state=location_check')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.latitude', 60);
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.locations_need_correction', 1);
        $this->assertSame($before, $bad->fresh()->getRawOriginal());
        try {
            app(ListingWorkflow::class)->assertComplete($bad);
            $this->fail('The invalid pin must block review.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('coordinates', $exception->errors());
        }
    }

    public function test_new_overseas_coordinates_cannot_be_saved_and_admin_has_a_location_queue(): void
    {
        $bad = $this->listing(['latitude' => -5, 'longitude' => 20]);
        $this->actingAs($bad->landlord)->postJson('/api/v1/landlord/properties', ['title' => 'New residence', 'city' => 'Manila', 'property_type' => 'dormitory', 'latitude' => 60, 'longitude' => 30])->assertUnprocessable()->assertJsonValidationErrors(['latitude', 'longitude']);
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->create(['role' => 'admin']))->getJson('/api/v1/admin/properties?location_check=needs_correction')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $bad->id);
    }

    public function test_existing_notification_context_is_batched_and_does_not_expose_private_messages_or_other_accounts(): void
    {
        $listing = $this->listing(['title' => 'College Street Residence']);
        $student = User::factory()->create();
        $thread = Inquiry::factory()->create(['property_id' => $listing->id, 'landlord_id' => $listing->landlord_id, 'student_id' => $student->id]);
        $viewing = ViewingRequest::factory()->create(['property_id' => $listing->id, 'landlord_id' => $listing->landlord_id, 'student_id' => $student->id]);
        $other = Inquiry::factory()->create();
        $recorder = app(ActivityRecorder::class);
        $recorder->notify($student->id, 'message:1', 'inquiry_message', 'You have a new message.', '/inquiries/'.$thread->id);
        $recorder->notify($student->id, 'viewing:'.$viewing->id.':1', 'viewing', 'Your viewing request has an update.', '/viewings');
        $recorder->notify($student->id, 'message:2', 'inquiry_message', 'You have a new message.', '/inquiries/'.$other->id);
        $recorder->notify($listing->landlord_id, 'review:1', 'listing_review', 'Your listing has been reviewed.', '/landlord/properties/'.$listing->id);
        $response = $this->actingAs($student)->getJson('/api/v1/notifications')->assertOk();
        $response->assertJsonCount(3, 'data')->assertJsonPath('data.0.listing_title', null)->assertJsonPath('data.1.listing_title', $listing->title)->assertJsonPath('data.2.listing_title', $listing->title);
        $this->assertArrayNotHasKey('event_key', $response->json('data.0'));
        $this->assertArrayNotHasKey('messages', $response->json('data.2'));
        $this->assertDatabaseCount('user_notifications', 4);
        $this->app['auth']->forgetGuards();
        $this->actingAs($listing->landlord)->getJson('/api/v1/notifications')->assertOk()->assertJsonPath('data.0.listing_title', $listing->title);
        $this->assertSame('You have a new message.', DB::table('user_notifications')->where('event_key', 'message:1')->value('title'));
    }

    public function test_more_notifications_do_not_add_queries_per_record(): void
    {
        $property = $this->listing();
        for ($index = 1; $index <= 20; $index++) {
            app(ActivityRecorder::class)->notify($property->landlord_id, 'review:'.$index, 'listing_review', 'Reviewed.', '/landlord/properties/'.$property->id);
        }
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = $query->sql;
        });
        $this->actingAs($property->landlord)->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('data.19.listing_title', $property->title);
        $contextQueries = array_filter($queries, fn (string $sql): bool => str_contains($sql, 'select "title", "id" from "properties"'));
        $this->assertCount(1, $contextQueries);
    }
}
