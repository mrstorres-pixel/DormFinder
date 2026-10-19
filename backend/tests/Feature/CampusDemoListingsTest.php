<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Inquiry;
use App\Models\Property;
use App\Models\User;
use App\Models\ViewingRequest;
use App\Services\CampusDemoListings;
use App\Services\DemoListings;
use App\Services\PhotoStorage;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CampusDemoListingsTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function people(): array
    {
        Storage::fake('local');
        config(['filesystems.default' => 'local']);

        return [User::factory()->landlord()->create(['email' => DemoListings::OWNER_EMAIL, 'name' => DemoListings::OWNER_NAME]), User::factory()->create(['role' => 'admin'])];
    }

    public function test_dry_run_has_three_per_campus_and_does_not_write(): void
    {
        $this->artisan('dormfinder:campus-demos')->expectsOutputToContain('Plan only')->assertSuccessful();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('properties', 0);
        $catalog = app(CampusDemoListings::class)->catalog();
        $this->assertCount(45, $catalog);
        $this->assertCount(45, array_unique(array_map(fn (array $row): string => $row['latitude'].','.$row['longitude'], $catalog)));
        $this->assertCount(9, array_unique(array_column($catalog, 'image')));
    }

    public function test_replacement_keeps_private_history_and_unrelated_data_and_reruns_without_changes(): void
    {
        $this->artisan('dormfinder:campuses', ['--apply' => true])->assertSuccessful();
        [$owner, $admin] = $this->people();
        $original = Property::factory()->create();
        $before = $original->fresh()->getRawOriginal();
        app(DemoListings::class)->populate($owner, $admin);
        $old = $owner->properties()->first();
        $oldRooms = $old->roomOptions()->get()->toArray();
        $oldPhotos = $old->photos()->get()->toArray();
        $student = User::factory()->create();
        $inquiry = Inquiry::factory()->create(['property_id' => $old->id, 'student_id' => $student->id, 'landlord_id' => $owner->id]);
        $viewing = ViewingRequest::factory()->create(['property_id' => $old->id, 'student_id' => $student->id, 'landlord_id' => $owner->id, 'room_option_id' => $old->roomOptions()->first()->id]);
        $inquiryBefore = $inquiry->fresh()->getRawOriginal();
        $viewingBefore = $viewing->fresh()->getRawOriginal();
        $result = app(CampusDemoListings::class)->populate($owner, $admin);
        $this->assertSame(45, $result['created']);
        $this->assertCount(19, $result['archived']);
        $this->assertSame('archived', $old->fresh()->status);
        $this->assertSame($before, $original->fresh()->getRawOriginal());
        $this->assertSame($oldRooms, $old->roomOptions()->get()->toArray());
        $this->assertSame($oldPhotos, $old->photos()->get()->toArray());
        $this->assertSame($inquiryBefore, $inquiry->fresh()->getRawOriginal());
        $this->assertSame($viewingBefore, $viewing->fresh()->getRawOriginal());
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonPath('meta.total', 45);
        $this->getJson('/api/v1/listings/'.$old->id)->assertNotFound();
        foreach (app(CampusDemoListings::class)->catalog() as $index => $entry) {
            $property = Property::findOrFail($result['ids'][$index]);
            $this->assertSame('approved', $property->status);
            $this->assertSame($entry['latitude'], $property->latitude);
            $this->assertSame($entry['longitude'], $property->longitude);
            $this->assertSame($entry['capacity'], $property->roomOptions()->first()->capacity);
            $this->assertStringContainsString('AI-generated', $property->photos()->first()->caption);
            $this->assertSame(IMAGETYPE_JPEG, getimagesizefromstring(Storage::disk('local')->get($property->photos()->first()->storage_key))[2]);
            $campus = Campus::where('slug', $entry['campus_slug'])->firstOrFail();
            $this->getJson('/api/v1/listings?campus_id='.$campus->id.'&radius_km=2&q='.urlencode($entry['title']))->assertOk()->assertJsonPath('data.0.id', $property->id);
        }
        $this->actingAs($student)->getJson('/api/v1/viewings?id='.$viewing->id)->assertOk()->assertJsonPath('data.0.id', $viewing->id)->assertJsonPath('data.0.can_schedule', false);
        $counts = [];
        foreach (['properties', 'room_options', 'property_photos', 'listing_reviews', 'moderation_actions'] as $table) {
            $counts[$table] = DB::table($table)->count();
        }
        $files = Storage::disk('local')->allFiles();
        $rerun = app(CampusDemoListings::class)->populate($owner, $admin);
        $this->assertSame(0, $rerun['created']);
        $this->assertSame(45, $rerun['skipped']);
        $this->assertSame([], $rerun['archived']);
        foreach ($counts as $table => $count) {
            $this->assertDatabaseCount($table, $count);
        }
        $this->assertSame($files, Storage::disk('local')->allFiles());
    }

    public function test_failed_upload_keeps_original_catalog_public_and_staged_samples_resume_safely(): void
    {
        [$owner, $admin] = $this->people();
        $old = Property::factory()->for($owner, 'landlord')->create(['is_demo' => true, 'status' => 'approved', 'description' => '[Sample set dormfinder-v1/1]']);
        $storage = new PhotoStorage;
        $calls = 0;
        $this->mock(PhotoStorage::class)->shouldReceive('upload')->andReturnUsing(function (...$arguments) use (&$calls, $storage) {
            if (++$calls === 4) {
                throw new \RuntimeException('Synthetic upload interruption.');
            }

            return $storage->upload(...$arguments);
        });
        try {
            app(CampusDemoListings::class)->populate($owner, $admin);
            $this->fail('Publication must stop after an interrupted upload.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Synthetic upload interruption.', $error->getMessage());
        }
        $this->assertSame('approved', $old->fresh()->status);
        $this->assertSame(1, Property::where('status', 'approved')->count());
        $this->assertSame(4, Property::where('status', 'draft')->count());
        $this->app->forgetInstance(PhotoStorage::class);
        $result = app(CampusDemoListings::class)->populate($owner, $admin);
        $this->assertSame(4, $result['resumed']);
        $this->assertSame(41, $result['created']);
        $this->assertSame(45, Property::where('status', 'approved')->count());
        $this->assertDatabaseCount('property_photos', 45);
    }

    public function test_wrong_reviewer_and_unconfirmed_production_target_do_not_change_data(): void
    {
        [$owner] = $this->people();
        try {
            app(CampusDemoListings::class)->populate($owner, $owner);
            $this->fail('An administrator is required.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('reviewer is invalid', $error->getMessage());
        }
        $this->app->instance('env', 'production');
        $this->artisan('dormfinder:campus-demos', ['--apply' => true])->expectsOutputToContain('approved production target')->assertFailed();
        $this->assertDatabaseCount('properties', 0);
    }
}
