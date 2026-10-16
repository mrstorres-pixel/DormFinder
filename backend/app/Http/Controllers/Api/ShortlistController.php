<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicPropertyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShortlistController extends Controller
{
    private function student(Request $request): int
    {
        abort_unless($request->user()->role === 'student', 403);

        return $request->user()->id;
    }

    private function owned(Request $request, int $id, bool $lock = false): object
    {
        if ($lock) {
            DB::table('users')->where('id', $this->student($request))->lockForUpdate()->first();
        }
        $query = DB::table('shortlists')->where('id', $id)->where('student_id', $this->student($request));
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first() ?? abort(404);
    }

    public function index(Request $request): JsonResponse
    {
        $student = $this->student($request);

        return response()->json(['data' => DB::table('shortlists')->where('student_id', $student)->select('id', 'name')->selectSub(DB::table('shortlist_items')->selectRaw('count(*)')->whereColumn('shortlist_id', 'shortlists.id'), 'items_count')->orderByDesc('id')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $student = $this->student($request);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        abort_unless(trim($data['name']) !== '', 422);
        $id = DB::transaction(function () use ($student, $data): int {
            DB::table('users')->where('id', $student)->lockForUpdate()->first();
            abort_if(DB::table('shortlists')->where('student_id', $student)->count() >= 10, 422, 'You can keep up to ten shortlists.');

            return DB::table('shortlists')->insertGetId(['student_id' => $student, 'name' => trim($data['name']), 'created_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['data' => ['id' => $id, 'name' => trim($data['name'])]], 201);
    }

    public function show(Request $request, int $shortlist): JsonResponse
    {
        $list = $this->owned($request, $shortlist);
        $items = DB::table('shortlist_items')->where('shortlist_id', $shortlist)->orderByDesc('id')->get();
        $properties = ListingController::publicQuery()->whereIn('id', $items->pluck('property_id'))->with(ListingController::relations())->get()->keyBy('id');

        return response()->json(['data' => ['id' => $list->id, 'name' => $list->name, 'items' => $items->map(function (object $item) use ($request, $properties): array {
            $property = $properties->get($item->property_id);

            return ['id' => $item->id, 'property_id' => $item->property_id, 'room_option_id' => $item->room_option_id, 'revision' => $item->revision, 'note' => $item->note, 'listing_snapshot' => json_decode($item->listing_snapshot, true, 512, JSON_THROW_ON_ERROR), 'listing' => $property ? (new PublicPropertyResource($property))->resolve($request) : null];
        })]]);
    }

    public function destroy(Request $request, int $shortlist): JsonResponse
    {
        $request->validate(['empty_only' => ['nullable', 'boolean']]);
        DB::transaction(function () use ($request, $shortlist): void {
            $this->owned($request, $shortlist, true);
            abort_if($request->boolean('empty_only') && DB::table('shortlist_items')->where('shortlist_id', $shortlist)->exists(), 409, 'This collection now contains saved places. Reopen it before deleting.');
            DB::table('shortlists')->where('id', $shortlist)->delete();
        });

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function add(Request $request, int $shortlist): JsonResponse
    {
        $this->owned($request, $shortlist);
        $data = $request->validate(['property_id' => ['required', 'integer', 'min:1'], 'room_option_id' => ['required', 'integer', 'min:1']]);
        $id = DB::transaction(function () use ($request, $shortlist, $data): int {
            $this->owned($request, $shortlist, true);
            $existing = DB::table('shortlist_items')->where('shortlist_id', $shortlist)->where('property_id', $data['property_id'])->first();
            if ($existing) {
                abort_unless($existing->room_option_id === (int) $data['room_option_id'], 409, 'This property is already on your list. Change its saved room option in Shortlists.');

                return $existing->id;
            }
            abort_if(DB::table('shortlist_items')->where('shortlist_id', $shortlist)->count() >= 30, 422, 'A shortlist can hold up to thirty properties.');
            $property = ListingController::publicQuery()->lockForUpdate()->findOrFail($data['property_id']);
            $option = $property->roomOptions()->findOrFail($data['room_option_id']);

            return DB::table('shortlist_items')->insertGetId(['shortlist_id' => $shortlist, 'property_id' => $property->id, 'room_option_id' => $option->id, 'listing_snapshot' => json_encode(['title' => $property->title, 'room_name' => $option->name], JSON_THROW_ON_ERROR), 'note' => '', 'revision' => 1, 'created_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function updateItem(Request $request, int $shortlist, int $item): JsonResponse
    {
        $this->owned($request, $shortlist);
        $data = $request->validate(['note' => ['present', 'nullable', 'string', 'max:1000'], 'room_option_id' => ['nullable', 'integer', 'min:1'], 'revision' => ['required', 'integer', 'min:1']]);
        DB::transaction(function () use ($request, $shortlist, $item, $data): void {
            $this->owned($request, $shortlist, true);
            $row = DB::table('shortlist_items')->where('shortlist_id', $shortlist)->where('id', $item)->lockForUpdate()->first() ?? abort(404);
            abort_unless($row->revision === (int) $data['revision'], 409);
            $changes = ['note' => trim($data['note'] ?? ''), 'revision' => $row->revision + 1, 'updated_at' => now()];
            if (isset($data['room_option_id']) && $data['room_option_id'] !== $row->room_option_id) {
                $property = ListingController::publicQuery()->lockForUpdate()->findOrFail($row->property_id);
                $option = $property->roomOptions()->findOrFail($data['room_option_id']);
                $changes['room_option_id'] = $option->id;
                $changes['listing_snapshot'] = json_encode(['title' => $property->title, 'room_name' => $option->name], JSON_THROW_ON_ERROR);
            }
            DB::table('shortlist_items')->where('id', $item)->update($changes);
        });

        return response()->json(['data' => ['saved' => true]]);
    }

    public function removeItem(Request $request, int $shortlist, int $item): JsonResponse
    {
        $this->owned($request, $shortlist);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1']]);
        DB::transaction(function () use ($request, $shortlist, $item, $data): void {
            $this->owned($request, $shortlist, true);
            $row = DB::table('shortlist_items')->where('shortlist_id', $shortlist)->where('id', $item)->lockForUpdate()->first() ?? abort(404);
            abort_unless($row->revision === $data['revision'], 409);
            DB::table('shortlist_items')->where('id', $item)->delete();
        });

        return response()->json(['data' => ['deleted' => true]]);
    }
}
