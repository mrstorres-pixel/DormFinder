<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicPropertyResource;
use App\Models\Campus;
use App\Models\Property;
use App\Services\CampusDistance;
use App\Services\ListingSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ListingController extends Controller
{
    public static function publicQuery(): Builder
    {
        return Property::query()->where('status', 'approved')->whereHas('landlord', fn ($query) => $query->where('status', 'active'));
    }

    public static function relations(): array
    {
        return ['roomOptions.fees', 'photos' => fn ($query) => $query->where('status', 'ready')];
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        return PublicPropertyResource::collection(ListingSearch::query(ListingSearch::parameters($request))->paginate(12)->withQueryString());
    }

    public function show(Request $request, int $property): PublicPropertyResource
    {
        $data = $request->validate(['campus_id' => ['nullable', 'integer', Rule::exists('campuses', 'id')->where('active', true)]]);

        return new PublicPropertyResource(CampusDistance::annotate(self::publicQuery(), CampusDistance::reference($data['campus_id'] ?? null))->with(self::relations())->findOrFail($property));
    }

    public function compare(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->role === 'student', 403);
        $data = $request->validate([
            'campus_id' => ['nullable', 'integer', Rule::exists('campuses', 'id')->where('active', true)],
            'selections' => ['required', 'array', 'min:1', 'max:3'],
            'selections.*' => ['array:property_id,room_option_id'],
            'selections.*.property_id' => ['required', 'integer', 'distinct', 'min:1'],
            'selections.*.room_option_id' => ['required', 'integer', 'min:1'],
        ]);
        $properties = CampusDistance::annotate(self::publicQuery(), CampusDistance::reference($data['campus_id'] ?? null))->with(self::relations())->whereIn('id', array_column($data['selections'], 'property_id'))->get()->keyBy('id');
        $ordered = collect();
        foreach ($data['selections'] as $selection) {
            $property = $properties->get($selection['property_id']);
            $option = $property?->roomOptions->firstWhere('id', $selection['room_option_id']);
            if (! $property || ! $option) {
                throw ValidationException::withMessages(['selections' => 'Select an existing room option from each public listing.']);
            }
            $property->setRelation('comparisonOptions', $property->roomOptions);
            $property->setRelation('roomOptions', collect([$option]));
            $ordered->push($property);
        }

        return PublicPropertyResource::collection($ordered);
    }

    public function campuses(): JsonResponse
    {
        return response()->json(['data' => Campus::query()->where('active', true)->orderBy('id')->get(['id', 'slug', 'name', 'address', 'latitude', 'longitude', 'source_url', 'reference_note'])]);
    }
}
