<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SavedPlaces;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SavedPlaceController extends Controller
{
    private function student(Request $request, bool $lock = false): int
    {
        abort_unless($request->user()->role === 'student', 403);
        $id = $request->user()->id;
        if ($lock) {
            DB::table('users')->where('id', $id)->lockForUpdate()->first();
        }

        return $id;
    }

    public function index(Request $request, SavedPlaces $saved): JsonResponse
    {
        $student = $this->student($request);
        $data = $request->validate(['page' => ['nullable', 'integer', 'min:1', 'max:100000'], 'collection' => ['nullable', 'integer', 'min:1']]);
        $collection = isset($data['collection']) ? (int) $data['collection'] : null;
        if ($collection !== null) {
            abort_unless(DB::table('shortlists')->where('student_id', $student)->where('id', $collection)->exists(), 404);
        }
        $page = DB::query()->fromSub($saved->sources($student, $collection), 'saved_sources')->select('property_id')->selectRaw('MAX(saved_at) AS last_saved_at')->groupBy('property_id')->orderByDesc('last_saved_at')->orderByDesc('property_id')->paginate(12)->withQueryString();
        $rows = $saved->entries($student, $page->getCollection()->pluck('property_id')->all(), $request);

        return response()->json(['data' => array_values($rows), 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()]]);
    }

    public function ids(Request $request, SavedPlaces $saved): JsonResponse
    {
        $student = $this->student($request);

        return response()->json(['data' => DB::query()->fromSub($saved->sources($student), 'saved_sources')->distinct()->orderBy('property_id')->pluck('property_id')]);
    }

    public function show(Request $request, int $property, SavedPlaces $saved): JsonResponse
    {
        $rows = $saved->entries($this->student($request), [$property], $request);

        return response()->json(['data' => $rows[$property] ?? abort(404)]);
    }

    public function store(Request $request, int $property, SavedPlaces $saved): JsonResponse
    {
        $data = $request->validate(['room_option_id' => ['nullable', 'integer', 'min:1']]);
        DB::transaction(function () use ($request, $property, $saved, $data): void {
            $student = $this->student($request, true);
            if (isset($saved->entries($student, [$property], $request)[$property])) {
                return;
            }
            $listing = ListingController::publicQuery()->lockForUpdate()->findOrFail($property);
            $option = isset($data['room_option_id']) ? $listing->roomOptions()->findOrFail($data['room_option_id']) : null;
            $saved->ensureFavorite($student, $property, ['title' => $listing->title, 'room_name' => $option?->name], $option?->id);
        });

        return $this->show($request, $property, $saved);
    }

    public function update(Request $request, int $property, SavedPlaces $saved): JsonResponse
    {
        $data = $request->validate(['version' => ['required', 'string', 'size:64'], 'context_id' => ['nullable', 'integer', 'min:1'], 'note' => ['present', 'nullable', 'string', 'max:1000'], 'room_option_id' => ['present', 'nullable', 'integer', 'min:1'], 'collection_ids' => ['present', 'array', 'max:10'], 'collection_ids.*' => ['integer', 'distinct', 'min:1'], 'confirm_remove' => ['nullable', 'boolean']]);
        DB::transaction(function () use ($request, $property, $saved, $data): void {
            $student = $this->student($request, true);
            $entry = $saved->entries($student, [$property], $request)[$property] ?? abort(404);
            abort_unless(hash_equals($entry['version'], $data['version']), 409, 'This saved place changed. Reopen it before saving; your edits have been kept.');
            $collectionIds = array_map('intval', $data['collection_ids']);
            abort_unless(DB::table('shortlists')->where('student_id', $student)->whereIn('id', $collectionIds)->count() === count($collectionIds), 404);
            $context = isset($data['context_id']) ? collect($entry['contexts'])->firstWhere('collection_id', (int) $data['context_id']) : null;
            abort_if(isset($data['context_id']) && ! $context, 404);
            abort_if($context && ! in_array($context['collection_id'], $collectionIds, true), 422, 'Switch to saved-place details before removing this collection.');
            $beforeOption = $context ? $context['room_option_id'] : DB::table('favorites')->where('student_id', $student)->where('property_id', $property)->value('room_option_id');
            $snapshot = $context ? $context['listing_snapshot'] : $entry['listing_snapshot'];
            if ($data['room_option_id'] !== $beforeOption) {
                if ($data['room_option_id'] !== null) {
                    $listing = ListingController::publicQuery()->findOrFail($property);
                    $option = $listing->roomOptions()->findOrFail($data['room_option_id']);
                    $snapshot = ['title' => $listing->title, 'room_name' => $option->name];
                } else {
                    $snapshot['room_name'] = null;
                }
            }
            $removed = collect($entry['contexts'])->reject(fn (array $item): bool => in_array($item['collection_id'], $collectionIds, true));
            abort_if($removed->isNotEmpty() && ! $request->boolean('confirm_remove'), 422, 'Confirm removal from collections and their collection-specific notes.');
            $saved->ensureFavorite($student, $property, $entry['listing_snapshot']);
            if ($context) {
                DB::table('shortlist_items')->where('id', $context['id'])->update(['room_option_id' => $data['room_option_id'], 'note' => trim($data['note'] ?? ''), 'listing_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'revision' => $context['revision'] + 1, 'updated_at' => now()]);
            } else {
                DB::table('favorites')->where('student_id', $student)->where('property_id', $property)->update(['room_option_id' => $data['room_option_id'], 'note' => trim($data['note'] ?? ''), 'listing_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'revision' => DB::raw('revision + 1'), 'updated_at' => now()]);
            }
            foreach ($collectionIds as $id) {
                if (collect($entry['contexts'])->contains('collection_id', $id)) {
                    continue;
                }
                abort_if(DB::table('shortlist_items')->where('shortlist_id', $id)->count() >= 30, 422, 'A collection can hold up to thirty places.');
                DB::table('shortlist_items')->insert(['shortlist_id' => $id, 'property_id' => $property, 'room_option_id' => $data['room_option_id'], 'listing_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'note' => '', 'revision' => 1, 'created_at' => now(), 'updated_at' => now()]);
            }
            if ($removed->isNotEmpty()) {
                DB::table('shortlist_items')->whereIn('id', $removed->pluck('id'))->delete();
            }
        });

        return $this->show($request, $property, $saved);
    }

    public function destroy(Request $request, int $property, SavedPlaces $saved): JsonResponse
    {
        $data = $request->validate(['version' => ['required', 'string', 'size:64']]);
        DB::transaction(function () use ($request, $property, $saved, $data): void {
            $student = $this->student($request, true);
            $entry = $saved->entries($student, [$property], $request)[$property] ?? abort(404);
            abort_unless(hash_equals($entry['version'], $data['version']), 409, 'This saved place changed. Reopen it before removing it.');
            DB::table('shortlist_items')->whereIn('id', collect($entry['contexts'])->pluck('id'))->delete();
            DB::table('favorites')->where('student_id', $student)->where('property_id', $property)->delete();
        });

        return response()->json(['data' => ['deleted' => true]]);
    }
}
