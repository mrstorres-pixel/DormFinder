<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\RoomOption;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SavedPlacesTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function become(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($user);
    }

    private function place(): array
    {
        $owner = User::factory()->landlord()->create();
        $property = Property::factory()->for($owner, 'landlord')->create(['status' => 'approved']);
        $room = RoomOption::factory()->for($property)->create();

        return [$property, $room];
    }

    private function edit(array $row, array $changes = []): array
    {
        return [...['version' => $row['version'], 'context_id' => null, 'note' => '', 'room_option_id' => $row['room_option_id'], 'collection_ids' => array_column($row['contexts'], 'collection_id')], ...$changes];
    }

    public function test_saving_needs_no_collection_and_retries_do_not_overwrite_room_or_note(): void
    {
        $this->become(User::factory()->create());
        [$property, $room] = $this->place();
        $row = $this->putJson('/api/v1/saved-places/'.$property->id, ['room_option_id' => $room->id])->assertOk()->assertJsonPath('data.room_option_id', $room->id)->json('data');
        $row = $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['note' => 'Quiet room near campus.']))->assertOk()->json('data');
        $other = RoomOption::factory()->for($property)->create();
        $this->putJson('/api/v1/saved-places/'.$property->id, ['room_option_id' => $other->id])->assertOk()->assertJsonPath('data.room_option_id', $room->id)->assertJsonPath('data.note', 'Quiet room near campus.');
        $this->getJson('/api/v1/saved-places/ids')->assertJsonPath('data.0', $property->id);
        $this->assertDatabaseCount('shortlists', 0);
        $this->assertDatabaseCount('favorites', 1);
    }

    public function test_legacy_favorites_and_multiple_collection_notes_are_deduplicated_without_being_rewritten(): void
    {
        $student = User::factory()->create();
        $this->become($student);
        [$property, $room] = $this->place();
        $other = RoomOption::factory()->for($property)->create();
        $this->putJson('/api/v1/favorites/'.$property->id)->assertOk();
        foreach ([[$room->id, 'Near campus', 'Keep the twin room.'], [$other->id, 'Budget', 'Different room and note.']] as [$option, $name, $note]) {
            $list = $this->postJson('/api/v1/shortlists', ['name' => $name])->json('data.id');
            $item = $this->postJson('/api/v1/shortlists/'.$list.'/items', ['property_id' => $property->id, 'room_option_id' => $option])->json('data.id');
            $this->patchJson('/api/v1/shortlists/'.$list.'/items/'.$item, ['revision' => 1, 'note' => $note])->assertOk();
        }
        $before = DB::table('shortlist_items')->orderBy('id')->get()->toJson();
        $this->getJson('/api/v1/saved-places')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.room_option_id', null)->assertJsonPath('data.0.contexts.0.note', 'Keep the twin room.')->assertJsonPath('data.0.contexts.1.room_option_id', $other->id);
        $this->assertSame($before, DB::table('shortlist_items')->orderBy('id')->get()->toJson());
        $this->getJson('/api/v1/saved-places?collection='.$list)->assertJsonCount(1, 'data');
        $savedTitle = $property->title;
        $property->forceFill(['status' => 'archived', 'title' => 'Private unpublished edit'])->save();
        $row = $this->getJson('/api/v1/saved-places')->assertJsonPath('data.0.listing', null)->assertJsonPath('data.0.listing_snapshot.title', $savedTitle)->json('data.0');
        $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['context_id' => $list, 'room_option_id' => $other->id, 'note' => 'Revisit when available.']))->assertOk()->assertJsonPath('data.listing', null)->assertJsonPath('data.contexts.0.note', 'Keep the twin room.')->assertJsonPath('data.contexts.1.note', 'Revisit when available.')->assertJsonPath('data.contexts.1.room_option_id', $other->id);
        $this->become(User::factory()->create());
        $this->getJson('/api/v1/saved-places/'.$property->id)->assertNotFound();
        $this->getJson('/api/v1/saved-places?collection='.$list)->assertNotFound();
        $this->getJson('/api/v1/saved-places/ids')->assertJsonCount(0, 'data');
    }

    public function test_collection_edits_and_removal_are_atomic_revision_checked_and_keep_the_saved_place(): void
    {
        $this->become(User::factory()->create());
        [$property, $room] = $this->place();
        $list = $this->postJson('/api/v1/shortlists', ['name' => 'Near campus'])->json('data.id');
        $row = $this->putJson('/api/v1/saved-places/'.$property->id, ['room_option_id' => $room->id])->json('data');
        $old = $row;
        $row = $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['note' => 'My main note', 'collection_ids' => [$list]]))->assertOk()->assertJsonCount(1, 'data.contexts')->json('data');
        $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($old))->assertConflict();
        $row = $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['context_id' => $list, 'note' => 'Collection note']))->assertOk()->assertJsonPath('data.note', 'My main note')->assertJsonPath('data.contexts.0.note', 'Collection note')->json('data');
        $this->deleteJson('/api/v1/shortlists/'.$list, ['empty_only' => true])->assertConflict();
        $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['note' => 'My main note', 'collection_ids' => []]))->assertUnprocessable();
        $this->getJson('/api/v1/saved-places/'.$property->id)->assertJsonPath('data.contexts.0.note', 'Collection note');
        $row = $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['note' => 'My main note', 'collection_ids' => [], 'confirm_remove' => true]))->assertOk()->assertJsonPath('data.note', 'My main note')->assertJsonCount(0, 'data.contexts')->json('data');
        $this->deleteJson('/api/v1/shortlists/'.$list, ['empty_only' => true])->assertOk();
        $this->deleteJson('/api/v1/saved-places/'.$property->id, ['version' => $old['version']])->assertConflict();
        $this->deleteJson('/api/v1/saved-places/'.$property->id, ['version' => $row['version']])->assertOk();
        $this->getJson('/api/v1/saved-places')->assertJsonCount(0, 'data');
    }

    public function test_foreign_rooms_collections_and_roles_cannot_modify_private_saved_details(): void
    {
        $student = User::factory()->create();
        $this->become($student);
        [$property, $room] = $this->place();
        $foreignRoom = RoomOption::factory()->create();
        $this->putJson('/api/v1/saved-places/'.$property->id, ['room_option_id' => $foreignRoom->id])->assertNotFound();
        $row = $this->putJson('/api/v1/saved-places/'.$property->id, ['room_option_id' => $room->id])->json('data');
        $this->become(User::factory()->create());
        $foreignList = $this->postJson('/api/v1/shortlists', ['name' => 'Private'])->json('data.id');
        $this->deleteJson('/api/v1/saved-places/'.$property->id, ['version' => $row['version']])->assertNotFound();
        $this->become($student);
        $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['collection_ids' => [$foreignList]]))->assertNotFound();
        $this->patchJson('/api/v1/saved-places/'.$property->id, $this->edit($row, ['room_option_id' => $foreignRoom->id]))->assertNotFound();
        $this->getJson('/api/v1/saved-places/'.$property->id)->assertJsonPath('data.room_option_id', $room->id);
        $this->become(User::factory()->landlord()->create());
        $this->getJson('/api/v1/saved-places')->assertForbidden();
        $this->putJson('/api/v1/saved-places/'.$property->id)->assertForbidden();
    }

    public function test_saved_pagination_includes_unpublished_places_and_collection_only_items(): void
    {
        $this->become($student = User::factory()->create());
        $properties = Property::factory()->count(13)->create();
        foreach ($properties as $property) {
            DB::table('favorites')->insert(['student_id' => $student->id, 'property_id' => $property->id, 'created_at' => now(), 'updated_at' => now()]);
        }
        [$property, $room] = $this->place();
        $list = $this->postJson('/api/v1/shortlists', ['name' => 'Only collection'])->json('data.id');
        $this->postJson('/api/v1/shortlists/'.$list.'/items', ['property_id' => $property->id, 'room_option_id' => $room->id])->assertCreated();
        $this->getJson('/api/v1/saved-places')->assertOk()->assertJsonCount(12, 'data')->assertJsonPath('meta.total', 14);
        $this->getJson('/api/v1/saved-places?page=2')->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/saved-places/'.$property->id)->assertJsonPath('data.room_option_id', $room->id)->assertJsonPath('data.default_context', $list);

        $this->getJson('/api/v1/saved-places/ids')->assertJsonCount(14, 'data');
    }
}
