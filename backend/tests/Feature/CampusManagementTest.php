<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampusManagementTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function details(array $changes = []): array
    {
        return [...['name' => 'Example University - North Gate', 'institution_name' => 'Example University', 'city' => 'Manila', 'address' => '12 College Street', 'latitude' => 14.6, 'longitude' => 120.99, 'source_url' => 'https://example.edu/campus', 'reference_note' => 'Pedestrian entrance on College Street.', 'aliases' => ['EU', 'Example North'], 'verified' => true], ...$changes];
    }

    private function become(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user);
    }

    public function test_admin_can_add_edit_and_deactivate_a_campus_without_replacing_its_id_or_references(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->become($admin);
        $created = $this->postJson('/api/v1/admin/campuses', $this->details())->assertCreated()->json('data');
        $id = $created['id'];
        $slug = $created['slug'];
        $student = User::factory()->create(['preferred_campus_id' => $id]);
        $this->patchJson('/api/v1/admin/campuses/'.$id, $this->details(['name' => 'Example University - Main Gate', 'revision' => 1]))->assertOk()->assertJsonPath('data.id', $id)->assertJsonPath('data.slug', $slug)->assertJsonPath('data.revision', 2);
        $this->patchJson('/api/v1/admin/campuses/'.$id, $this->details(['revision' => 1]))->assertConflict();
        $this->patchJson('/api/v1/admin/campuses/'.$id.'/visibility', ['active' => false, 'revision' => 2, 'confirmed' => true])->assertOk();
        $this->assertSame($id, $student->fresh()->preferred_campus_id);
        $this->getJson('/api/v1/campuses')->assertOk()->assertJsonMissing(['id' => $id]);
        $this->getJson('/api/v1/admin/campuses?active=inactive&q=Example')->assertOk()->assertJsonPath('data.0.id', $id);
        $this->getJson('/api/v1/admin/campuses/'.$id.'/history')->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('data.0.action', 'deactivated');
        $this->patchJson('/api/v1/admin/campuses/'.$id.'/visibility', ['active' => true, 'revision' => 3, 'confirmed' => true])->assertOk();
        $this->getJson('/api/v1/campuses')->assertJsonFragment(['id' => $id]);
    }

    public function test_campus_writes_require_admin_verification_and_valid_entrance_details(): void
    {
        $this->become(User::factory()->create(['role' => 'landlord']));
        $this->postJson('/api/v1/admin/campuses', $this->details())->assertForbidden();
        $this->getJson('/api/v1/admin/campuses')->assertForbidden();
        $this->become(User::factory()->create(['role' => 'admin']));
        $this->postJson('/api/v1/admin/campuses', $this->details(['verified' => false]))->assertUnprocessable();
        $this->postJson('/api/v1/admin/campuses', $this->details(['latitude' => 60]))->assertUnprocessable();
        $this->postJson('/api/v1/admin/campuses', $this->details(['source_url' => 'javascript:alert(1)']))->assertUnprocessable();
        $this->postJson('/api/v1/admin/campuses', $this->details())->assertCreated();
        $this->postJson('/api/v1/admin/campuses', $this->details(['name' => 'example university - north gate']))->assertUnprocessable();
        $this->assertDatabaseCount('campus_actions', 1);
    }

    public function test_suggestions_are_private_idempotent_and_can_be_resolved_by_creating_a_verified_campus(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $owner = User::factory()->create(['role' => 'landlord']);
        $payload = ['client_id' => (string) Str::uuid(), 'name' => 'Example University - North Gate', 'city' => 'Manila', 'address' => '12 College Street', 'source_url' => 'https://example.edu/campus'];
        $this->become($student);
        $id = $this->postJson('/api/v1/campus-suggestions', $payload)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/campus-suggestions', $payload)->assertCreated()->assertJsonPath('data.id', $id);
        $this->postJson('/api/v1/campus-suggestions', [...$payload, 'client_id' => (string) Str::uuid()])->assertCreated()->assertJsonPath('data.id', $id);
        $this->postJson('/api/v1/campus-suggestions', [...$payload, 'address' => 'Different address'])->assertConflict();
        $this->become($owner);
        $this->getJson('/api/v1/campus-suggestions')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/v1/admin/campus-suggestions/'.$id.'/resolve', ['status' => 'declined', 'revision' => 1, 'note' => 'Missing official campus details.'])->assertForbidden();
        $this->become(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/v1/admin/campus-suggestions')->assertOk()->assertJsonCount(1, 'data');
        $campusId = $this->postJson('/api/v1/admin/campuses', $this->details(['suggestion_id' => $id, 'suggestion_revision' => 1]))->assertCreated()->json('data.id');
        $this->assertDatabaseHas('campus_suggestions', ['id' => $id, 'status' => 'added', 'campus_id' => $campusId, 'revision' => 2]);
        $this->assertDatabaseHas('user_notifications', ['recipient_id' => $student->id, 'kind' => 'campus']);
    }

    public function test_resolving_a_stale_suggestion_rolls_back_campus_creation_and_duplicate_links_preserve_existing_campuses(): void
    {
        $student = User::factory()->create();
        $this->become($student);
        $id = $this->postJson('/api/v1/campus-suggestions', ['client_id' => (string) Str::uuid(), 'name' => 'Example branch', 'city' => 'Manila', 'address' => '12 College Street'])->assertCreated()->json('data.id');
        $campus = Campus::factory()->create();
        $this->become(User::factory()->create(['role' => 'admin']));
        $this->postJson('/api/v1/admin/campus-suggestions/'.$id.'/resolve', ['status' => 'duplicate', 'revision' => 1, 'campus_id' => $campus->id, 'note' => 'This branch already exists in the directory.'])->assertOk();
        $before = Campus::count();
        $this->postJson('/api/v1/admin/campuses', $this->details(['suggestion_id' => $id, 'suggestion_revision' => 1]))->assertConflict();
        $this->assertSame($before, Campus::count());
        $this->assertSame(0, DB::table('campus_actions')->count());
    }

    public function test_requester_can_read_feedback_and_resubmit_without_seeing_another_users_request(): void
    {
        $student = User::factory()->create();
        $this->become($student);
        $body = ['client_id' => (string) Str::uuid(), 'name' => 'Missing branch', 'city' => 'Manila', 'address' => '20 College Street'];
        $id = $this->postJson('/api/v1/campus-suggestions', $body)->assertCreated()->json('data.id');
        $this->become(User::factory()->create(['role' => 'admin']));
        $note = 'Please provide the official branch address and website.';
        $this->postJson('/api/v1/admin/campus-suggestions/'.$id.'/resolve', ['status' => 'declined', 'revision' => 1, 'note' => $note])->assertOk();
        $this->become($student);
        $this->getJson('/api/v1/campus-suggestions')->assertOk()->assertJsonPath('data.0.resolution_note', $note);
        $this->getJson('/api/v1/admin/campus-suggestions')->assertForbidden();
        $this->postJson('/api/v1/campus-suggestions', [...$body, 'client_id' => (string) Str::uuid(), 'source_url' => 'https://example.edu/branch'])->assertCreated();
        $this->assertDatabaseCount('campus_suggestions', 2);
        $this->become(User::factory()->create());
        $this->getJson('/api/v1/campus-suggestions')->assertJsonCount(0, 'data');
    }
}
