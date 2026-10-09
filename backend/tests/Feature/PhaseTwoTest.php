<?php

namespace Tests\Feature;

use App\Models\Inquiry;
use App\Models\Property;
use App\Models\PropertyPhoto;
use App\Models\RoomOption;
use App\Models\RoomOptionFee;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PhaseTwoTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function become(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user);
    }

    private function completeProperty(string $status = 'draft'): Property
    {
        $property = Property::factory()->create(['status' => $status, 'latitude' => 14.598, 'longitude' => 120.99, 'approved_at' => $status === 'approved' ? now() : null]);
        RoomOption::factory()->for($property)->create();
        PropertyPhoto::factory()->for($property)->create(['status' => 'ready']);

        return $property;
    }

    private function optionData(int $revision = 1): array
    {
        return ['revision' => $revision, 'name' => 'Shared room A', 'inventory_type' => 'bedspace', 'price_basis' => 'per_person', 'capacity' => 4, 'total_units' => 8, 'available_units' => 3, 'monthly_rent_centavos' => 350000, 'deposit_centavos' => 350000, 'advance_months' => 1, 'utilities_notes' => 'Electricity metered separately; water included.', 'fees' => [['name' => 'Internet', 'frequency' => 'monthly', 'amount_centavos' => 25000], ['name' => 'Key deposit', 'frequency' => 'one_time', 'amount_centavos' => 10000]]];
    }

    public function test_room_options_preserve_integer_charges_and_demote_approved_listings(): void
    {
        $property = Property::factory()->create(['status' => 'approved', 'approved_at' => now()]);
        $this->become($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/room-options', $this->optionData())
            ->assertOk()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.room_options.0.monthly_fixed_total_centavos', 375000)
            ->assertJsonPath('data.room_options.0.move_in_fixed_total_centavos', 710000);
        $this->assertNull($property->fresh()->approved_at);
        $this->assertDatabaseCount('room_option_fees', 2);
    }

    public function test_invalid_inventory_basis_and_foreign_ownership_cannot_write_rooms(): void
    {
        $property = Property::factory()->create();
        $this->become($property->landlord);
        $data = $this->optionData();
        $data['available_units'] = 9;
        $data['price_basis'] = 'per_room';
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/room-options', $data)
            ->assertUnprocessable()->assertJsonValidationErrors(['available_units', 'price_basis']);
        $this->become(User::factory()->landlord()->create());
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/room-options', $this->optionData())->assertNotFound();
        $this->assertDatabaseCount('room_options', 0);
    }

    public function test_room_revision_and_nested_property_binding_prevent_overwrites(): void
    {
        $property = $this->completeProperty();
        $option = $property->roomOptions()->first();
        $other = RoomOption::factory()->create();
        $this->become($property->landlord);
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/room-options/'.$other->id, $this->optionData())->assertNotFound();
        $this->patchJson('/api/v1/landlord/properties/'.$property->id.'/room-options/'.$option->id, $this->optionData(2))->assertConflict();
        $this->assertSame(1, $property->fresh()->revision);
        $this->assertNotSame('Shared room A', $option->fresh()->name);
    }

    public function test_duplicate_room_names_are_rejected_without_changing_revision(): void
    {
        $property = $this->completeProperty();
        $data = $this->optionData();
        $data['name'] = strtoupper($property->roomOptions()->first()->name);
        $this->become($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/room-options', $data)->assertUnprocessable();
        $this->assertSame(1, $property->fresh()->revision);
    }

    public function test_submission_validates_completeness_and_locks_pending_edits(): void
    {
        $incomplete = Property::factory()->create();
        $this->become($incomplete->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$incomplete->id.'/submit', ['revision' => 1, 'inventory_confirmed' => true])->assertUnprocessable()->assertJsonValidationErrors(['coordinates', 'photos', 'room_options']);
        $property = $this->completeProperty();
        $this->become($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/submit', ['revision' => 1, 'inventory_confirmed' => true])->assertOk()->assertJsonPath('data.status', 'pending_review');
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/room-options', $this->optionData(2))->assertConflict();
        $this->assertSame(2, $property->fresh()->revision);
    }

    public function test_stale_availability_blocks_submission(): void
    {
        $property = $this->completeProperty();
        $property->roomOptions()->first()->update(['availability_confirmed_at' => now()->subDays(15)]);
        $this->become($property->landlord);
        $this->postJson('/api/v1/landlord/properties/'.$property->id.'/submit', ['revision' => 1, 'inventory_confirmed' => true])->assertUnprocessable()->assertJsonValidationErrors('availability');
    }

    public function test_only_administrator_can_review_and_stale_decisions_do_not_publish(): void
    {
        $property = $this->completeProperty('pending_review');
        $data = ['revision' => 1, 'decision' => 'approved', 'review_confirmed' => true];
        $this->become($property->landlord);
        $this->getJson('/api/v1/admin/reviews')->assertForbidden();
        $this->postJson('/api/v1/admin/reviews/'.$property->id.'/decision', $data)->assertForbidden();
        $this->become(User::factory()->state(['role' => 'admin'])->create());
        $this->postJson('/api/v1/admin/reviews/'.$property->id.'/decision', [...$data, 'revision' => 2])->assertConflict();
        $this->postJson('/api/v1/admin/reviews/'.$property->id.'/decision', $data)->assertOk()->assertJsonPath('data.status', 'approved');
        $this->assertDatabaseHas('listing_reviews', ['property_id' => $property->id, 'decision' => 'approved', 'revision' => 1]);
    }

    public function test_rejection_requires_reason_and_is_visible_to_the_owner(): void
    {
        $property = $this->completeProperty('pending_review');
        $this->become(User::factory()->state(['role' => 'admin'])->create());
        $path = '/api/v1/admin/reviews/'.$property->id.'/decision';
        $this->postJson($path, ['revision' => 1, 'decision' => 'rejected', 'review_confirmed' => true])->assertUnprocessable();
        $this->postJson($path, ['revision' => 1, 'decision' => 'rejected', 'review_confirmed' => true, 'reason' => 'Clarify electricity charges.'])->assertOk();
        $this->become($property->landlord);
        $this->getJson('/api/v1/landlord/properties/'.$property->id)->assertJsonPath('data.moderation_reason', 'Clarify electricity charges.');
        $this->getJson('/api/v1/listings/'.$property->id)->assertNotFound();
    }

    public function test_public_listings_hide_drafts_suspended_owners_and_private_fields(): void
    {
        $public = $this->completeProperty('approved');
        $draft = $this->completeProperty();
        $hidden = $this->completeProperty('approved');
        $hidden->landlord->status = 'suspended';
        $hidden->landlord->save();
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $public->id)->assertJsonMissingPath('data.0.revision')->assertJsonMissingPath('data.0.moderation_reason')->assertJsonMissingPath('data.0.landlord_id');
        $this->getJson('/api/v1/listings/'.$draft->id)->assertNotFound();
        $this->getJson('/api/v1/listings/'.$hidden->id)->assertNotFound();
    }

    public function test_comparison_validates_selected_option_ownership_and_three_property_limit(): void
    {
        $first = $this->completeProperty('approved');
        $second = $this->completeProperty('approved');
        $this->become(User::factory()->create());
        $valid = ['property_id' => $first->id, 'room_option_id' => $first->roomOptions()->first()->id];
        $this->postJson('/api/v1/compare', ['selections' => [$valid]])->assertOk()->assertJsonCount(1, 'data')->assertJsonCount(1, 'data.0.room_options');
        $this->postJson('/api/v1/compare', ['selections' => [['property_id' => $first->id, 'room_option_id' => $second->roomOptions()->first()->id]]])->assertUnprocessable();
        $this->postJson('/api/v1/compare', ['selections' => [$valid, $valid]])->assertUnprocessable();
        $this->postJson('/api/v1/compare', ['selections' => [$valid, $valid, $valid, $valid]])->assertUnprocessable();
        $this->become($first->landlord);
        $this->postJson('/api/v1/compare', ['selections' => [$valid]])->assertForbidden();
    }

    public function test_inquiry_messages_are_participant_only_and_retries_are_idempotent(): void
    {
        $property = $this->completeProperty('approved');
        $student = User::factory()->create();
        $this->become($student);
        $data = ['room_option_id' => $property->roomOptions()->first()->id, 'body' => 'Is a bed available next month?', 'client_id' => (string) Str::uuid()];
        $path = '/api/v1/listings/'.$property->id.'/inquiries';
        $id = $this->postJson($path, $data)->assertCreated()->json('data.id');
        $this->postJson($path, $data)->assertCreated()->assertJsonPath('data.id', $id);
        $this->postJson($path, [...$data, 'body' => 'A different message with the same ID'])->assertConflict();
        $this->assertDatabaseCount('inquiries', 1);
        $this->assertDatabaseCount('inquiry_messages', 1);
        foreach ([User::factory()->create(), User::factory()->landlord()->create(), User::factory()->state(['role' => 'admin'])->create()] as $outsider) {
            $this->become($outsider);
            $this->getJson('/api/v1/inquiries/'.$id)->assertNotFound();
            $this->getJson('/api/v1/inquiries/'.$id.'/messages')->assertNotFound();
            $this->postJson('/api/v1/inquiries/'.$id.'/messages', ['body' => 'Unauthorized', 'client_id' => (string) Str::uuid()])->assertNotFound();
            if ($outsider->role === 'admin') {
                $this->getJson('/api/v1/inquiries')->assertForbidden();
            }
        }
        $this->become($property->landlord);
        $reply = ['body' => 'Yes, please confirm your intended move-in date.', 'client_id' => (string) Str::uuid()];
        $this->postJson('/api/v1/inquiries/'.$id.'/messages', $reply)->assertCreated();
        $this->postJson('/api/v1/inquiries/'.$id.'/messages', $reply)->assertCreated();
        $this->become($student);
        $this->getJson('/api/v1/inquiries/'.$id.'/messages')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.1.body', $reply['body']);
    }

    public function test_inquiries_preserve_snapshot_after_edits_and_freeze_on_suspension(): void
    {
        $property = $this->completeProperty('approved');
        $student = User::factory()->create();
        $this->become($student);
        $id = $this->postJson('/api/v1/listings/'.$property->id.'/inquiries', ['room_option_id' => $property->roomOptions()->first()->id, 'body' => 'Hello', 'client_id' => (string) Str::uuid()])->assertCreated()->json('data.id');
        $originalTitle = $property->title;
        $this->become($property->landlord);
        $this->deleteJson('/api/v1/landlord/properties/'.$property->id.'/room-options/'.$property->roomOptions()->first()->id, ['revision' => 1])->assertOk()->assertJsonPath('data.status', 'draft');
        $this->postJson('/api/v1/inquiries/'.$id.'/messages', ['body' => 'The original option is being updated.', 'client_id' => (string) Str::uuid()])->assertCreated();
        $this->become($student);
        $this->getJson('/api/v1/inquiries/'.$id)->assertJsonPath('data.listing_snapshot.title', $originalTitle)->assertJsonPath('data.can_reply', true);
        $property->status = 'suspended';
        $property->save();
        $this->getJson('/api/v1/inquiries/'.$id)->assertJsonPath('data.can_reply', false);
        $this->postJson('/api/v1/inquiries/'.$id.'/messages', ['body' => 'Should not send', 'client_id' => (string) Str::uuid()])->assertConflict();
        $this->getJson('/api/v1/inquiries/'.$id.'/messages')->assertOk()->assertJsonCount(2, 'data');
        $this->assertNotNull(Inquiry::findOrFail($id));
    }

    public function test_database_constraints_reject_invalid_inventory_even_outside_validation(): void
    {
        $this->expectException(QueryException::class);
        RoomOption::factory()->create(['available_units' => 20, 'total_units' => 2]);
    }

    public function test_readiness_requires_the_phase_two_migration(): void
    {
        DB::table('migrations')->where('migration', '2026_10_09_090053_create_phase_two_workflow_tables')->delete();
        $this->getJson('/api/v1/health')->assertStatus(503)->assertJsonPath('code', 'service_unavailable');
    }

    public function test_monthly_fees_remain_distinct_from_move_in_costs(): void
    {
        $property = $this->completeProperty('approved');
        $option = $property->roomOptions()->first();
        RoomOptionFee::factory()->for($option)->create(['amount_centavos' => 12345]);
        $this->getJson('/api/v1/listings/'.$property->id)->assertJsonPath('data.room_options.0.monthly_fixed_total_centavos', 362345)->assertJsonPath('data.room_options.0.move_in_fixed_total_centavos', 700000);
    }

    public function test_controlled_admin_command_uses_a_private_file_and_never_overwrites_an_account(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'dormfinder-admin-');
        file_put_contents($path, 'SyntheticAdministrator1234');
        try {
            $this->artisan('dormfinder:admin', ['email' => 'synthetic-admin@example.test', '--name' => 'Synthetic Review Administrator', '--password-file' => $path, '--no-interaction' => true])->assertExitCode(0);
            $this->assertDatabaseHas('users', ['email' => 'synthetic-admin@example.test', 'role' => 'admin']);
            $this->artisan('dormfinder:admin', ['email' => 'synthetic-admin@example.test', '--name' => 'Overwrite', '--password-file' => $path, '--no-interaction' => true])->assertExitCode(1);
            $this->assertDatabaseHas('users', ['email' => 'synthetic-admin@example.test', 'name' => 'Synthetic Review Administrator']);
        } finally {
            unlink($path);
        }
    }
}
