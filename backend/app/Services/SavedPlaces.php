<?php

namespace App\Services;

use App\Http\Controllers\Api\ListingController;
use App\Http\Resources\PublicPropertyResource;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SavedPlaces
{
    public function sources(int $student, ?int $collection = null): Builder
    {
        $items = DB::table('shortlist_items')->join('shortlists', 'shortlists.id', '=', 'shortlist_items.shortlist_id')->where('shortlists.student_id', $student)->select('shortlist_items.property_id', 'shortlist_items.updated_at as saved_at');
        if ($collection !== null) {
            return $items->where('shortlists.id', $collection);
        }

        return DB::table('favorites')->where('student_id', $student)->select('property_id', 'updated_at as saved_at')->unionAll($items);
    }

    public function contexts(int $student): Builder
    {
        return DB::table('shortlist_items')->join('shortlists', 'shortlists.id', '=', 'shortlist_items.shortlist_id')->where('shortlists.student_id', $student)->select('shortlist_items.*', 'shortlists.name as collection_name')->orderBy('shortlist_items.id');
    }

    public function version(?object $favorite, iterable $contexts): string
    {
        $values = [$favorite ? [$favorite->id, $favorite->revision] : null];
        foreach ($contexts as $context) {
            $values[] = [$context->id, $context->revision];
        }

        return hash('sha256', json_encode($values, JSON_THROW_ON_ERROR));
    }

    public function entries(int $student, array $ids, Request $request): array
    {
        $favorites = DB::table('favorites')->where('student_id', $student)->whereIn('property_id', $ids)->get()->keyBy('property_id');
        $contexts = $this->contexts($student)->whereIn('shortlist_items.property_id', $ids)->get()->groupBy('property_id');
        $owned = array_values(array_unique([...$favorites->keys()->all(), ...$contexts->keys()->all()]));
        $properties = ListingController::publicQuery()->whereIn('id', $owned)->with(ListingController::relations())->get()->keyBy('id');
        $result = [];
        foreach ($ids as $id) {
            $favorite = $favorites->get($id);
            $items = $contexts->get($id, collect());
            if (! $favorite && $items->isEmpty()) {
                continue;
            }
            $property = $properties->get($id);
            $snapshot = $favorite?->listing_snapshot ? json_decode($favorite->listing_snapshot, true, 512, JSON_THROW_ON_ERROR) : ($items->first()?->listing_snapshot ? json_decode($items->first()->listing_snapshot, true, 512, JSON_THROW_ON_ERROR) : ['title' => $property?->title ?? 'Unavailable saved place', 'room_name' => null]);
            $single = $items->count() === 1 && (! $favorite || ($favorite->room_option_id === null && $favorite->note === '')) ? $items->first() : null;
            $result[$id] = ['property_id' => (int) $id, 'version' => $this->version($favorite, $items), 'room_option_id' => $single?->room_option_id ?? $favorite?->room_option_id, 'note' => $single?->note ?? $favorite?->note ?? '', 'default_context' => $single?->shortlist_id, 'saved_details' => ['room_option_id' => $favorite?->room_option_id, 'note' => $favorite?->note ?? ''], 'listing_snapshot' => $snapshot, 'listing' => $property ? (new PublicPropertyResource($property))->resolve($request) : null, 'contexts' => $items->map(fn (object $item): array => ['id' => $item->id, 'collection_id' => $item->shortlist_id, 'collection_name' => $item->collection_name, 'room_option_id' => $item->room_option_id, 'note' => $item->note, 'revision' => $item->revision, 'listing_snapshot' => json_decode($item->listing_snapshot, true, 512, JSON_THROW_ON_ERROR)])->values()->all()];
        }

        return $result;
    }

    public function ensureFavorite(int $student, int $property, array $snapshot, ?int $option = null): void
    {
        DB::table('favorites')->insertOrIgnore(['student_id' => $student, 'property_id' => $property, 'room_option_id' => $option, 'listing_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'note' => '', 'revision' => 1, 'created_at' => now(), 'updated_at' => now()]);
    }
}
