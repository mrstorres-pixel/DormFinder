<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\PropertyPhoto;
use App\Models\RoomOption;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminWorkspaceTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_listing_filters_apply_before_pagination_and_preserve_owner_context(): void
    {
        $owner = User::factory()->landlord()->create(['name' => 'Campus Owner']);
        $listings = Property::factory()->count(14)->create(['landlord_id' => $owner->id, 'status' => 'pending_review', 'property_type' => 'dormitory', 'title' => 'Campus Residence']);
        Property::factory()->create(['status' => 'draft', 'title' => 'Other residence']);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $query = '?q=Campus%20Owner&property_type=dormitory&sort=oldest&per_page=12&page=2';
        $this->getJson('/api/v1/admin/reviews'.$query)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 14)->assertJsonPath('data.0.id', $listings[12]->id)->assertJsonPath('data.0.landlord_name', 'Campus Owner');
        $this->getJson('/api/v1/admin/properties'.$query.'&status=pending_review')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 14);
        $this->getJson('/api/v1/admin/properties?q=%25')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/properties?sort=title%3BDROP&per_page=999')->assertUnprocessable()->assertJsonValidationErrors(['sort', 'per_page']);
    }

    public function test_account_search_role_and_status_filters_do_not_expose_administrators_or_secrets(): void
    {
        User::factory()->landlord()->count(14)->create(['name' => 'Campus Owner']);
        $student = User::factory()->create(['name' => 'Campus Student', 'status' => 'suspended']);
        $this->actingAs(User::factory()->create(['role' => 'admin', 'name' => 'Campus Administrator']));
        $this->getJson('/api/v1/admin/users?q=campus&role=landlord&sort=name_asc&per_page=12&page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('total', 14)->assertJsonMissingPath('data.0.password')->assertJsonMissingPath('data.0.remember_token');
        $this->getJson('/api/v1/admin/users?status=suspended&role=student')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $student->id);
        $this->getJson('/api/v1/admin/users?q=Administrator')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/users?q=%5F')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_report_filters_and_pagination_preserve_private_review_information(): void
    {
        $student = User::factory()->create(['name' => 'Campus Student']);
        $property = Property::factory()->create();
        foreach (range(1, 14) as $index) {
            DB::table('listing_reports')->insert(['student_id' => $student->id, 'property_id' => Property::factory()->create()->id, 'listing_title' => 'Campus Residence', 'client_id' => Str::uuid(), 'category' => 'misleading', 'body' => 'Private review concern '.$index, 'status' => 'open', 'created_at' => now(), 'updated_at' => now()]);
        }
        DB::table('listing_reports')->insert(['student_id' => $student->id, 'property_id' => $property->id, 'listing_title' => 'Campus Residence', 'client_id' => Str::uuid(), 'category' => 'other', 'body' => 'A resolved private concern.', 'status' => 'resolved', 'created_at' => now(), 'updated_at' => now()]);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/v1/admin/reports?q=Campus%20Student&status=open&category=misleading&sort=newest&page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('total', 14)->assertJsonPath('data.0.student_name', 'Campus Student');
        $this->getJson('/api/v1/admin/reports?status=resolved')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/reports?status=all')->assertOk()->assertJsonPath('total', 15);
    }

    public function test_audit_filters_use_philippine_calendar_days_and_show_readable_context(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'name' => 'Review Administrator']);
        $property = Property::factory()->create(['title' => 'Campus Residence']);
        $activity = app(ActivityRecorder::class);
        foreach (['2026-10-19 15:59:59', '2026-10-19 16:00:00', '2026-10-20 15:59:59', '2026-10-20 16:00:00'] as $date) {
            $id = $activity->audit($admin->id, 'listing_review', 'pending_review', 'approved', 2, 'Reviewed accurate listing details.', $property->id);
            DB::table('moderation_actions')->where('id', $id)->update(['created_at' => $date]);
        }
        $this->actingAs($admin);
        $this->getJson('/api/v1/admin/audit?q=Campus&action=listing_review&from=2026-10-20&to=2026-10-20&sort=oldest')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.actor_name', 'Review Administrator')->assertJsonPath('data.0.listing_title', 'Campus Residence');
        $this->getJson('/api/v1/admin/audit?from=2026-10-21&to=2026-10-20')->assertUnprocessable()->assertJsonValidationErrors('to');
    }

    public function test_all_admin_directories_reject_non_administrators(): void
    {
        foreach (['student', 'landlord'] as $role) {
            $this->app['auth']->forgetGuards();
            $this->actingAs(User::factory()->create(['role' => $role]));
            foreach (['reviews', 'properties', 'users', 'reports', 'audit'] as $path) {
                $this->getJson('/api/v1/admin/'.$path)->assertForbidden();
            }
        }
    }

    public function test_review_submission_explains_outdated_availability_without_changing_the_draft(): void
    {
        $property = Property::factory()->create(['status' => 'draft', 'description' => 'A complete description of this fictional student residence.', 'address' => 'A real street address', 'latitude' => 14.6, 'longitude' => 121.0]);
        RoomOption::factory()->for($property)->create(['availability_confirmed_at' => now()->subDays(15)]);
        PropertyPhoto::factory()->for($property)->create(['status' => 'ready']);
        $this->actingAs($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/submit', ['revision' => $property->revision, 'inventory_confirmed' => true])->assertUnprocessable()->assertJsonValidationErrors('availability');
        $this->assertSame('draft', $property->fresh()->status);
    }
}
