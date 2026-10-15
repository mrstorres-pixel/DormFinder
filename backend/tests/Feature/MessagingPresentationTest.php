<?php

namespace Tests\Feature;

use App\Models\Inquiry;
use App\Models\InquiryMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MessagingPresentationTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function become(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user);
    }

    public function test_profile_photo_is_normalized_and_only_visible_to_self_and_conversation_participants(): void
    {
        Storage::fake('local');
        $inquiry = Inquiry::factory()->create();
        $this->become($inquiry->student);
        $this->getJson('/api/v1/me/avatar')->assertOk()->assertJsonPath('data.has_avatar', false);
        $this->postJson('/api/v1/me/avatar', ['photo' => UploadedFile::fake()->image('portrait.png', 800, 1000)])
            ->assertOk()->assertJsonPath('data.has_avatar', true);
        $key = 'avatars/'.$inquiry->student_id.'/profile.jpg';
        Storage::disk('local')->assertExists($key);
        $image = getimagesizefromstring(Storage::disk('local')->get($key));
        $this->assertSame(IMAGETYPE_JPEG, $image[2]);
        $this->assertLessThanOrEqual(512, max($image[0], $image[1]));
        $this->get('/api/v1/avatars/'.$inquiry->student_id)->assertOk()->assertHeader('Content-Type', 'image/jpeg')->assertHeader('Cache-Control', 'no-store, private');
        $this->become($inquiry->landlord);
        $this->get('/api/v1/avatars/'.$inquiry->student_id)->assertOk();
        $this->become(User::factory()->create());
        $this->get('/api/v1/avatars/'.$inquiry->student_id)->assertNotFound();
        Storage::disk('local')->assertExists($key);
        $this->become($inquiry->student);
        $this->deleteJson('/api/v1/me/avatar')->assertOk()->assertJsonPath('data.has_avatar', false);
        Storage::disk('local')->assertMissing($key);
        $this->get('/api/v1/avatars/'.$inquiry->student_id)->assertOk()->assertHeader('Content-Type', 'image/svg+xml');
    }

    public function test_invalid_photo_does_not_replace_an_existing_photo_and_guests_cannot_read_it(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $key = 'avatars/'.$user->id.'/profile.jpg';
        Storage::disk('local')->put($key, 'existing-private-image');
        $this->get('/api/v1/avatars/'.$user->id)->assertUnauthorized();
        $this->become($user);
        $this->postJson('/api/v1/me/avatar', ['photo' => UploadedFile::fake()->create('unsafe.svg', 4, 'image/svg+xml')])->assertUnprocessable();
        $this->postJson('/api/v1/me/avatar', ['photo' => UploadedFile::fake()->image('huge.png', 4000, 4000)])->assertUnprocessable();
        $this->assertSame('existing-private-image', Storage::disk('local')->get($key));
    }

    public function test_latest_history_and_preview_remain_participant_only_and_old_pages_still_work(): void
    {
        $inquiry = Inquiry::factory()->create();
        $messages = InquiryMessage::factory()->count(35)->create(['inquiry_id' => $inquiry->id, 'sender_id' => $inquiry->landlord_id]);
        $this->become($inquiry->student);
        $this->getJson('/api/v1/inquiries')->assertOk()->assertJsonPath('data.0.last_message_body', $messages->last()->body)
            ->assertJsonPath('data.0.participant_role', 'landlord')->assertJsonPath('data.0.last_message_is_own', false)
            ->assertJsonPath('data.0.participant_avatar_url', $inquiry->landlord->avatarUrl());
        $this->getJson('/api/v1/inquiries/'.$inquiry->id.'/messages?latest=1')->assertOk()->assertJsonPath('meta.current_page', 2)
            ->assertJsonCount(5, 'data')->assertJsonPath('data.0.id', $messages[30]->id)->assertJsonPath('data.0.sender_avatar_url', $inquiry->landlord->avatarUrl());
        $this->getJson('/api/v1/inquiries/'.$inquiry->id.'/messages?page=1')->assertOk()->assertJsonCount(30, 'data')->assertJsonPath('data.0.id', $messages[0]->id);
        $this->become(User::factory()->create());
        $this->getJson('/api/v1/inquiries')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/inquiries/'.$inquiry->id.'/messages?latest=1')->assertNotFound();
    }

    public function test_storage_failure_does_not_change_personal_details_or_prevent_account_access(): void
    {
        $user = User::factory()->create();
        $this->become($user);
        Storage::shouldReceive('disk')->andThrow(new \RuntimeException('Synthetic storage outage'));
        $this->getJson('/api/v1/me/avatar')->assertStatus(503);
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.name', $user->name);
        $this->postJson('/api/v1/me/avatar', ['photo' => UploadedFile::fake()->image('portrait.jpg')])->assertStatus(503);
        $this->assertSame($user->name, $user->fresh()->name);
        $this->get('/api/v1/avatars/'.$user->id)->assertOk()->assertHeader('Content-Type', 'image/svg+xml');
    }
}
