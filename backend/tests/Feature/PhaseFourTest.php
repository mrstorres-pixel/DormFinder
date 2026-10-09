<?php

namespace Tests\Feature;

use App\Models\Inquiry;
use App\Models\Property;
use App\Models\PropertyPhoto;
use App\Models\RoomOption;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PhaseFourTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function become(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user->fresh());
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    private function listing(string $status = 'approved'): Property
    {
        $property = Property::factory()->create(['status' => $status, 'approved_at' => $status === 'approved' ? now() : null, 'latitude' => 14.598, 'longitude' => 120.99]);
        RoomOption::factory()->for($property)->create();
        PropertyPhoto::factory()->for($property)->create(['status' => 'ready']);

        return $property;
    }

    private function reportData(): array
    {
        return ['category' => 'misleading', 'body' => 'The synthetic listing contains misleading details.', 'client_id' => (string) Str::uuid()];
    }

    private function action(string $action, int $revision = 1): array
    {
        return ['action' => $action, 'revision' => $revision, 'reason' => 'Synthetic moderation decision with sufficient explanation.'];
    }

    public function test_reports_are_private_retry_safe_and_do_not_automatically_hide_listings(): void
    {
        $admin = $this->admin();
        $student = User::factory()->create();
        $property = $this->listing();
        $this->become($student);
        $data = $this->reportData();
        $id = $this->postJson('/api/v1/listings/'.$property->id.'/reports', $data)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', $data)->assertCreated()->assertJsonPath('data.id', $id);
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', array_merge($data, ['body' => 'Different details for the same retry identifier.']))->assertConflict();
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', $this->reportData())->assertConflict();
        $this->getJson('/api/v1/reports')->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.resolution_reason');
        $this->getJson('/api/v1/listings/'.$property->id)->assertOk()->assertJsonMissingPath('data.reports')->assertJsonMissingPath('data.landlord_id');
        $this->become(User::factory()->create());
        $this->getJson('/api/v1/reports?student_id='.$student->id)->assertOk()->assertJsonCount(0, 'data');
        $this->become($property->landlord);
        $this->getJson('/api/v1/reports')->assertForbidden();
        $this->getJson('/api/v1/admin/reports')->assertForbidden();
        $this->become($admin);
        $this->getJson('/api/v1/admin/reports')->assertOk()->assertJsonPath('data.0.body', $data['body']);
        $this->assertDatabaseCount('listing_reports', 1);
        $this->assertDatabaseCount('user_notifications', 1);
    }

    public function test_reports_require_an_active_student_and_public_listing_and_validate_content(): void
    {
        $property = $this->listing('draft');
        $this->become(User::factory()->create());
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', $this->reportData())->assertNotFound();
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', ['category' => 'sql', 'body' => ' ', 'client_id' => 'bad'])->assertUnprocessable();
        $this->become($this->admin());
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', $this->reportData())->assertForbidden();
        $this->become(User::factory()->suspended()->create());
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', $this->reportData())->assertForbidden();
        $this->assertDatabaseCount('listing_reports', 0);
    }

    public function test_report_resolution_is_revision_checked_audited_and_does_not_expose_private_notes(): void
    {
        $student = User::factory()->create();
        $property = $this->listing();
        $this->become($student);
        $data = $this->reportData();
        $id = $this->postJson('/api/v1/listings/'.$property->id.'/reports', $data)->json('data.id');
        $this->become($this->admin());
        $resolution = ['status' => 'resolved', 'revision' => 1, 'reason' => 'Private administrator resolution notes for verification.'];
        $this->postJson('/api/v1/admin/reports/'.$id.'/resolve', array_merge($resolution, ['reason' => ' ']))->assertUnprocessable();
        $this->postJson('/api/v1/admin/reports/'.$id.'/resolve', array_merge($resolution, ['revision' => 99]))->assertConflict();
        $this->postJson('/api/v1/admin/reports/'.$id.'/resolve', $resolution)->assertOk();
        $this->postJson('/api/v1/admin/reports/'.$id.'/resolve', $resolution)->assertConflict();
        $this->getJson('/api/v1/admin/audit')->assertOk()->assertJsonPath('data.0.listing_report_id', $id)->assertJsonPath('data.0.reason', $resolution['reason']);
        $this->become($student);
        $response = $this->getJson('/api/v1/reports')->assertOk()->assertJsonPath('data.0.status', 'resolved');
        $this->assertStringNotContainsString($resolution['reason'], $response->getContent());
        $this->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', $data)->assertCreated()->assertJsonPath('data.status', 'resolved');
        $this->postJson('/api/v1/listings/'.$property->id.'/reports', $this->reportData())->assertCreated();
        $this->assertDatabaseCount('moderation_actions', 1);
    }

    public function test_suspension_freezes_replies_and_only_admin_can_restore_to_draft(): void
    {
        $property = $this->listing();
        $student = User::factory()->create();
        $this->become($student);
        $thread = $this->postJson('/api/v1/listings/'.$property->id.'/inquiries', ['body' => 'Synthetic private inquiry body never for administrators.', 'room_option_id' => $property->roomOptions()->first()->id, 'client_id' => (string) Str::uuid()])->assertCreated()->json('data.id');
        $this->become($this->admin());
        $endpoint = '/api/v1/admin/properties/'.$property->id.'/moderation';
        $this->postJson($endpoint, $this->action('suspend'))->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->postJson($endpoint, $this->action('suspend'))->assertConflict();
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        $this->getJson('/api/v1/inquiries/'.$thread.'/messages')->assertNotFound();
        $this->become($student);
        $this->getJson('/api/v1/inquiries/'.$thread)->assertOk()->assertJsonPath('data.can_reply', false);
        $this->postJson('/api/v1/inquiries/'.$thread.'/messages', ['body' => 'A new reply cannot be sent while suspended.', 'client_id' => (string) Str::uuid()])->assertConflict();
        $this->become($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/lifecycle', $this->action('restore', 2))->assertConflict();
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/lifecycle', $this->action('archive', 2))->assertConflict();
        $this->become($this->admin());
        $this->postJson($endpoint, $this->action('restore', 2))->assertOk()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.approved_at', null);
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        $this->become($student);
        $this->getJson('/api/v1/inquiries/'.$thread)->assertOk()->assertJsonPath('data.can_reply', true);
        $this->assertDatabaseCount('moderation_actions', 2);
    }

    public function test_owner_archival_preserves_history_and_requires_review_after_restoration(): void
    {
        $property = $this->listing();
        $student = User::factory()->create();
        $thread = Inquiry::factory()->for($property)->create(['landlord_id' => $property->landlord_id, 'student_id' => $student->id]);
        $this->become(User::factory()->landlord()->create());
        $path = '/api/v1/landlord/properties/'.$property->id.'/lifecycle';
        $this->postJson($path, $this->action('archive'))->assertNotFound();
        $this->become($property->landlord);
        $this->postJson($path, $this->action('archive'))->assertOk()->assertJsonPath('data.status', 'archived');
        $this->postJson($path, $this->action('archive'))->assertConflict();
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/submit', ['revision' => 2, 'inventory_confirmed' => true])->assertConflict();
        $this->become($student);
        $this->getJson('/api/v1/inquiries/'.$thread->id)->assertOk()->assertJsonPath('data.can_reply', true);
        $this->become($property->landlord);
        $this->postJson($path, $this->action('restore', 2))->assertOk()->assertJsonPath('data.status', 'draft');
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        $this->assertDatabaseHas('inquiries', ['id' => $thread->id]);
        $this->assertDatabaseCount('moderation_actions', 2);
    }

    public function test_account_suspension_revokes_sessions_hides_public_and_pending_listings_and_reactivation_does_not_republish(): void
    {
        $admin = $this->admin();
        $property = $this->listing();
        $owner = $property->landlord;
        $pending = Property::factory()->for($owner, 'landlord')->create(['status' => 'pending_review', 'submitted_at' => now()]);
        $suspended = Property::factory()->for($owner, 'landlord')->create(['status' => 'suspended']);
        DB::table('sessions')->insert(['id' => 'synthetic-session', 'user_id' => $owner->id, 'payload' => '', 'last_activity' => time()]);
        $this->become($admin);
        $path = '/api/v1/admin/users/'.$owner->id.'/moderation';
        $this->postJson($path, $this->action('suspend'))->assertOk()->assertJsonPath('data.hidden_listings', 2);
        $this->assertDatabaseMissing('sessions', ['user_id' => $owner->id]);
        $this->assertDatabaseHas('properties', ['id' => $property->id, 'status' => 'draft', 'revision' => 2, 'approved_at' => null]);
        $this->assertDatabaseHas('properties', ['id' => $pending->id, 'status' => 'draft', 'submitted_at' => null]);
        $this->assertDatabaseHas('properties', ['id' => $suspended->id, 'status' => 'suspended']);
        $this->postJson($path, $this->action('reactivate'))->assertConflict();
        $this->postJson($path, $this->action('reactivate', 2))->assertOk()->assertJsonPath('data.status', 'active');
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
        $this->assertDatabaseCount('moderation_actions', 4);
        $this->become($owner);
        $this->getJson('/api/v1/landlord/properties/'.$property->id)->assertOk()->assertJsonPath('data.status', 'draft');
    }

    public function test_student_suspension_freezes_the_counterpart_and_rejects_suspended_requests(): void
    {
        $property = $this->listing();
        $student = User::factory()->create();
        $thread = Inquiry::factory()->for($property)->create(['landlord_id' => $property->landlord_id, 'student_id' => $student->id]);
        $this->become($this->admin());
        $path = '/api/v1/admin/users/'.$student->id.'/moderation';
        $this->postJson($path, $this->action('suspend'))->assertOk();
        $this->become($property->landlord);
        $this->getJson('/api/v1/inquiries/'.$thread->id)->assertOk()->assertJsonPath('data.can_reply', false);
        $this->postJson('/api/v1/inquiries/'.$thread->id.'/messages', ['body' => 'Attempt while participant is unavailable.', 'client_id' => (string) Str::uuid()])->assertConflict();
        $this->become($student);
        $this->getJson('/api/v1/dashboard')->assertForbidden();
    }

    public function test_admin_accounts_are_protected_and_nonadmins_cannot_read_or_write_moderation(): void
    {
        $admin = $this->admin();
        $property = $this->listing();
        $this->become($admin);
        $this->postJson('/api/v1/admin/users/'.$admin->id.'/moderation', $this->action('suspend'))->assertForbidden();
        $other = $this->admin();
        $this->postJson('/api/v1/admin/users/'.$other->id.'/moderation', $this->action('suspend'))->assertForbidden();
        $this->getJson('/api/v1/admin/users?id='.$admin->id)->assertOk()->assertJsonCount(0, 'data');
        foreach ([User::factory()->create(), $property->landlord] as $user) {
            $this->become($user);
            foreach (['admin/users', 'admin/audit', 'admin/properties', 'admin/reports'] as $path) {
                $this->getJson('/api/v1/'.$path)->assertForbidden();
            }
            $this->postJson('/api/v1/admin/users/'.$other->id.'/moderation', $this->action('suspend'))->assertForbidden();
            $this->postJson('/api/v1/admin/properties/'.$property->id.'/moderation', $this->action('suspend'))->assertForbidden();
        }
        $this->assertDatabaseCount('moderation_actions', 0);
    }

    public function test_notifications_are_recipient_scoped_have_no_message_previews_and_mark_read_idempotently(): void
    {
        $property = $this->listing();
        $student = User::factory()->create();
        $this->become($student);
        $data = ['body' => 'Private inquiry details never shown in notifications.', 'room_option_id' => $property->roomOptions()->first()->id, 'client_id' => (string) Str::uuid()];
        $this->postJson('/api/v1/listings/'.$property->id.'/inquiries', $data)->assertCreated();
        $this->postJson('/api/v1/listings/'.$property->id.'/inquiries', $data)->assertCreated();
        $id = DB::table('user_notifications')->where('recipient_id', $property->landlord_id)->value('id');
        $this->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(0, 'data');
        $this->putJson('/api/v1/notifications/'.$id.'/read')->assertNotFound();
        $this->become($property->landlord);
        $response = $this->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(1, 'data');
        $this->assertStringNotContainsString($data['body'], $response->getContent());
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.unread_notifications', 1);
        $this->putJson('/api/v1/notifications/'.$id.'/read')->assertOk();
        $read = DB::table('user_notifications')->where('id', $id)->value('read_at');
        $this->putJson('/api/v1/notifications/'.$id.'/read')->assertOk();
        $this->assertSame($read, DB::table('user_notifications')->where('id', $id)->value('read_at'));
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.unread_notifications', 0);
        $this->become($this->admin());
        $this->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_dashboard_counts_are_role_scoped_and_never_expose_inquiry_content(): void
    {
        $property = $this->listing();
        $other = $this->listing();
        $student = User::factory()->create();
        Inquiry::factory()->for($property)->create(['student_id' => $student->id, 'landlord_id' => $property->landlord_id]);
        Inquiry::factory()->for($other)->create(['landlord_id' => $other->landlord_id]);
        $this->become($student);
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.inquiries', 1)->assertJsonMissingPath('data.active_students');
        $this->become($property->landlord);
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.inquiries', 1)->assertJsonPath('data.listings.approved', 1);
        $this->become($this->admin());
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.published_listings', 2)->assertJsonMissingPath('data.inquiries');
        $this->getJson('/api/v1/admin/users?q=%25')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/properties?status=approved')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_failed_notification_rolls_back_the_entire_moderation_decision(): void
    {
        $property = $this->listing();
        $this->become($this->admin());
        $this->partialMock(ActivityRecorder::class, function ($mock): void {
            $mock->shouldReceive('notify')->once()->andThrow(new \RuntimeException('Synthetic notification failure.'));
        });
        $this->postJson('/api/v1/admin/properties/'.$property->id.'/moderation', $this->action('suspend'))->assertStatus(500)->assertJsonPath('code', 'server_error');
        $this->assertDatabaseHas('properties', ['id' => $property->id, 'status' => 'approved', 'revision' => 1]);
        $this->assertDatabaseCount('moderation_actions', 0);
        $this->assertDatabaseCount('user_notifications', 0);
    }

    public function test_review_notifications_and_audit_are_recorded_once_and_health_requires_phase_four(): void
    {
        $property = $this->listing('pending_review');
        $this->become($this->admin());
        $data = ['decision' => 'approved', 'revision' => 1, 'review_confirmed' => true];
        $this->postJson('/api/v1/admin/reviews/'.$property->id.'/decision', $data)->assertOk();
        $this->postJson('/api/v1/admin/reviews/'.$property->id.'/decision', $data)->assertConflict();
        $this->assertDatabaseCount('moderation_actions', 1);
        $this->assertDatabaseCount('user_notifications', 1);
        $this->getJson('/api/v1/health')->assertOk()->assertJsonPath('data.phase', 4);
        DB::table('migrations')->where('migration', '2026_10_09_111157_create_phase_four_moderation_tables')->delete();
        $this->getJson('/api/v1/health')->assertStatus(503);
    }
}
