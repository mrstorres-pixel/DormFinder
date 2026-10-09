<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\User;
use App\Services\DemoListings;
use App\Services\DemoRoomImage;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DemoListingsTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function people(): array
    {
        Storage::fake('local');
        config(['filesystems.default' => 'local']);

        return [
            User::factory()->landlord()->create(['email' => DemoListings::OWNER_EMAIL, 'name' => DemoListings::OWNER_NAME]),
            User::factory()->create(['role' => 'admin']),
        ];
    }

    public function test_plan_changes_neither_database_nor_storage(): void
    {
        $this->artisan('dormfinder:demo-listings')->expectsOutputToContain('Plan only')->assertSuccessful();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('properties', 0);
    }

    public function test_samples_use_normal_photo_storage_and_review_records_without_changing_other_listings(): void
    {
        [$owner, $admin] = $this->people();
        $original = Property::factory()->create();
        $before = $original->fresh()->getRawOriginal();
        $result = app(DemoListings::class)->populate($owner, $admin);
        $this->assertSame(19, $result['created']);
        $this->assertSame($before, $original->fresh()->getRawOriginal());
        $this->assertSame(16, Property::where('is_demo', true)->where('status', 'approved')->count());
        foreach (['draft', 'pending_review', 'rejected'] as $status) {
            $this->assertSame(1, Property::where('is_demo', true)->where('status', $status)->count());
        }
        $this->assertDatabaseCount('room_options', 38);
        $this->assertDatabaseCount('room_option_fees', 76);
        $this->assertDatabaseCount('property_photos', 38);
        $this->assertDatabaseCount('listing_reviews', 17);
        $this->assertDatabaseCount('moderation_actions', 17);
        $this->assertCount(38, Storage::disk('local')->allFiles());
        foreach (DB::table('property_photos')->get() as $photo) {
            $this->assertSame('ready', $photo->status);
            $this->assertSame(IMAGETYPE_JPEG, getimagesizefromstring(Storage::disk('local')->get($photo->storage_key))[2]);
        }
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonPath('meta.total', 16)->assertJsonCount(12, 'data')->assertJsonPath('data.0.is_demo', true);
        $this->getJson('/api/v1/listings?page=2')->assertOk()->assertJsonCount(4, 'data');
        foreach (Property::where('is_demo', true)->where('status', '!=', 'approved')->get() as $private) {
            $this->getJson('/api/v1/listings/'.$private->id)->assertNotFound();
        }
        $this->getJson('/api/v1/listings?price_basis=per_person&min_rent_centavos=350029&max_rent_centavos=350029')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', '[DEMO] Study Nook Residence');
        $this->getJson('/api/v1/listings?q=Mixed%20Availability&price_basis=per_person&max_rent_centavos=500000&available_only=1')
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings?q=Mixed%20Availability&price_basis=per_person&min_rent_centavos=800000&available_only=1')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/listings?q=Fully%20Booked&available_only=1')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/listings?q=Needs%20Confirmation&available_only=1')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_rerun_preserves_renamed_and_moderated_samples_without_new_records_or_files(): void
    {
        [$owner, $admin] = $this->people();
        $service = app(DemoListings::class);
        $service->populate($owner, $admin);
        $edited = $owner->properties()->first();
        $edited->forceFill(['title' => 'Owner changed this sample', 'status' => 'suspended', 'revision' => 20])->save();
        $counts = [];
        foreach (['properties', 'room_options', 'property_photos', 'listing_reviews', 'moderation_actions', 'user_notifications'] as $table) {
            $counts[$table] = DB::table($table)->count();
        }
        $files = Storage::disk('local')->allFiles();
        $result = $service->populate($owner, $admin);
        $this->assertSame(0, $result['created']);
        $this->assertSame(19, $result['skipped']);
        $this->assertSame('suspended', $edited->fresh()->status);
        $this->assertSame('Owner changed this sample', $edited->fresh()->title);
        foreach ($counts as $table => $count) {
            $this->assertDatabaseCount($table, $count);
        }
        $this->assertSame($files, Storage::disk('local')->allFiles());
    }

    public function test_missing_credentials_or_conflicting_reserved_account_are_rejected_without_password_reset(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->artisan('dormfinder:demo-listings', ['--apply' => true, '--administrator' => $admin->email])
            ->assertFailed();
        $path = tempnam(sys_get_temp_dir(), 'demo-test-');
        file_put_contents($path, 'SampleOnlyPassword12345');
        $existing = User::factory()->create(['email' => DemoListings::OWNER_EMAIL]);
        $hash = $existing->password;
        try {
            $this->artisan('dormfinder:demo-listings', ['--apply' => true, '--administrator' => $admin->email, '--password-file' => $path])
                ->expectsOutputToContain('Existing account and password preserved')->assertFailed();
            $this->assertSame($hash, $existing->fresh()->password);
            $this->assertSame('student', $existing->fresh()->role);
            $this->assertDatabaseCount('properties', 0);
        } finally {
            unlink($path);
        }
    }

    public function test_invalid_reviewer_cannot_create_samples(): void
    {
        [$owner] = $this->people();
        $student = User::factory()->create();
        try {
            app(DemoListings::class)->populate($owner, $student);
            $this->fail('An active administrator must be required.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('reviewer is invalid', $exception->getMessage());
        }
        $this->assertDatabaseCount('properties', 0);
        $this->assertCount(0, Storage::disk('local')->allFiles());
    }

    public function test_interrupted_image_generation_leaves_a_private_draft_and_can_resume_without_duplicate_photos(): void
    {
        [$owner, $admin] = $this->people();
        $calls = 0;
        $this->mock(DemoRoomImage::class)->shouldReceive('create')->andReturnUsing(function (int $index, int $view, string $name) use (&$calls) {
            if (++$calls === 2) {
                throw new \RuntimeException('Simulated image-generation interruption.');
            }

            return (new DemoRoomImage)->create($index, $view, $name);
        });
        try {
            app(DemoListings::class)->populate($owner, $admin);
            $this->fail('The controlled interruption should stop publication.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Simulated image-generation interruption.', $exception->getMessage());
        }
        $this->assertDatabaseCount('properties', 1);
        $this->assertDatabaseCount('property_photos', 1);
        $this->assertSame('draft', Property::first()->status);
        $this->app->forgetInstance(DemoRoomImage::class);
        $result = app(DemoListings::class)->populate($owner, $admin);
        $this->assertSame(1, $result['resumed']);
        $this->assertSame(18, $result['created']);
        $this->assertDatabaseCount('property_photos', 38);
        $this->assertSame(16, Property::where('status', 'approved')->count());
    }

    public function test_production_requires_the_explicit_approved_project_before_creating_an_account(): void
    {
        $this->app->instance('env', 'production');
        $this->artisan('dormfinder:demo-listings', ['--apply' => true])
            ->expectsOutputToContain('approved production target')->assertFailed();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('properties', 0);
    }
}
