<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicPropertyResource;
use App\Models\Property;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
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
        $data = $request->validate(['q' => ['nullable', 'string', 'max:100'], 'page' => ['nullable', 'integer', 'min:1']]);
        $query = self::publicQuery()->with(self::relations());
        if (filled($data['q'] ?? null)) {
            $query->where(function (Builder $query) use ($data): void {
                $query->where('title', 'ilike', '%'.$data['q'].'%')->orWhere('city', 'ilike', '%'.$data['q'].'%');
            });
        }

        return PublicPropertyResource::collection($query->latest('approved_at')->paginate(12)->withQueryString());
    }

    public function show(int $property): PublicPropertyResource
    {
        return new PublicPropertyResource(self::publicQuery()->with(self::relations())->findOrFail($property));
    }

    public function compare(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->role === 'student', 403);
        $data = $request->validate([
            'selections' => ['required', 'array', 'min:1', 'max:3'],
            'selections.*' => ['array:property_id,room_option_id'],
            'selections.*.property_id' => ['required', 'integer', 'distinct', 'min:1'],
            'selections.*.room_option_id' => ['required', 'integer', 'min:1'],
        ]);
        $properties = self::publicQuery()->with(self::relations())->whereIn('id', array_column($data['selections'], 'property_id'))->get()->keyBy('id');
        $ordered = collect();
        foreach ($data['selections'] as $selection) {
            $property = $properties->get($selection['property_id']);
            $option = $property?->roomOptions->firstWhere('id', $selection['room_option_id']);
            if (! $property || ! $option) {
                throw ValidationException::withMessages(['selections' => 'Select an existing room option from each public listing.']);
            }
            $property->setRelation('roomOptions', collect([$option]));
            $ordered->push($property);
        }

        return PublicPropertyResource::collection($ordered);
    }
}
