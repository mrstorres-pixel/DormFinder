<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Property;
use App\Models\PropertyPhoto;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Tests\TestCase;

class PhotoControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_uploads_a_reencoded_private_image_and_issues_a_signed_url(): void
    {
        Storage::fake('local');
        $property = Property::factory()->create();

        $response = $this->actingAs($property->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/photos', [
            'photo' => UploadedFile::fake()->image('room.png', 2000, 1000),
            'upload_id' => (string) Str::uuid(), 'revision' => 1, 'caption' => 'Demo room',
        ]);

        $response->assertCreated()->assertJsonPath('data.status', 'ready');
        $photo = PropertyPhoto::firstOrFail();
        Storage::disk('local')->assertExists($photo->storage_key);
        $size = getimagesizefromstring(Storage::disk('local')->get($photo->storage_key));
        $this->assertSame([1600, 800, IMAGETYPE_JPEG], array_slice($size, 0, 3));
        $this->assertStringContainsString('signature=', $response->json('data.url'));
        $this->assertSame(2, $property->fresh()->revision);
    }

    public function test_other_landlord_cannot_upload_to_a_property(): void
    {
        Storage::fake('local');
        $property = Property::factory()->create();

        $this->actingAs(User::factory()->landlord()->create())->postJson('/api/v1/landlord/properties/'.$property->id.'/photos', [
            'photo' => UploadedFile::fake()->image('room.jpg'), 'upload_id' => (string) Str::uuid(), 'revision' => 1,
        ])->assertNotFound();
        $this->assertDatabaseCount('property_photos', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_rejects_svg_files(): void
    {
        $property = Property::factory()->create();

        $this->actingAs($property->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/photos', [
            'photo' => UploadedFile::fake()->createWithContent('room.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
            'upload_id' => (string) Str::uuid(), 'revision' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('photo');
        $this->assertDatabaseCount('property_photos', 0);
    }

    public function test_rejects_oversized_uploads(): void
    {
        $property = Property::factory()->create();

        $this->actingAs($property->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/photos', [
            'photo' => UploadedFile::fake()->image('large.jpg')->size(3073),
            'upload_id' => (string) Str::uuid(), 'revision' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('photo');
        $this->assertDatabaseCount('property_photos', 0);
    }

    public function test_retries_reuse_the_same_ready_photo(): void
    {
        Storage::fake('local');
        $property = Property::factory()->create(['revision' => 2]);
        $photo = PropertyPhoto::factory()->for($property)->create();

        $this->actingAs($property->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/photos', [
            'photo' => UploadedFile::fake()->image('retry.jpg'), 'upload_id' => $photo->upload_id, 'revision' => 1,
        ])->assertCreated()->assertJsonPath('data.id', $photo->id);
        $this->assertDatabaseCount('property_photos', 1);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_unsigned_local_photo_access_is_forbidden(): void
    {
        $photo = PropertyPhoto::factory()->create();

        $this->getJson('/api/v1/media/'.$photo->id)->assertForbidden();
    }

    public function test_expired_photo_urls_are_forbidden(): void
    {
        $photo = PropertyPhoto::factory()->create();
        $url = URL::temporarySignedRoute('photos.local', now()->subMinute(), ['photo' => $photo->id], absolute: false);

        $this->getJson($url)->assertForbidden();
    }

    public function test_rejects_a_ninth_photo_without_creating_an_object(): void
    {
        Storage::fake('local');
        $property = Property::factory()->create();
        PropertyPhoto::factory()->count(8)->for($property)->create();

        $this->actingAs($property->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/photos', [
            'photo' => UploadedFile::fake()->image('extra.jpg'), 'upload_id' => (string) Str::uuid(), 'revision' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('photo');
        $this->assertDatabaseCount('property_photos', 8);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_deleted_photo_is_removed_from_storage(): void
    {
        Storage::fake('local');
        $property = Property::factory()->create();
        $photo = PropertyPhoto::factory()->for($property)->create();
        Storage::disk('local')->put($photo->storage_key, 'demo');

        $this->actingAs($property->landlord)->deleteJson('/api/v1/landlord/properties/'.$property->id.'/photos/'.$photo->id, [
            'revision' => 1,
        ])->assertOk()->assertJsonPath('data.deleted', true);
        Storage::disk('local')->assertMissing($photo->storage_key);
        $this->assertModelMissing($photo);
    }

    public function test_storage_failure_leaves_no_ready_photo(): void
    {
        $property = Property::factory()->create();
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('put')->once()->andThrow(new \RuntimeException('Unavailable'));
        $disk->shouldReceive('delete')->once()->andReturn(false);
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);

        $this->actingAs($property->landlord)->postJson('/api/v1/landlord/properties/'.$property->id.'/photos', [
            'photo' => UploadedFile::fake()->image('room.jpg'), 'upload_id' => (string) Str::uuid(), 'revision' => 1,
        ])->assertServiceUnavailable();
        $this->assertDatabaseHas('property_photos', ['property_id' => $property->id, 'status' => 'pending_deletion']);
        $this->assertDatabaseMissing('property_photos', ['property_id' => $property->id, 'status' => 'ready']);
    }
}
