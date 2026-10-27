<?php

namespace App\Services;

use App\Http\Controllers\Api\ListingController;
use App\Models\RoomOption;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ListingSearch
{
    public static function parameters(Request $request): array
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'], 'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'property_type' => ['nullable', Rule::in(['dormitory', 'apartment', 'boarding_house', 'rental_room'])],
            'price_basis' => ['nullable', 'required_with:min_rent_centavos,max_rent_centavos', Rule::in(['per_person', 'per_room'])],
            'min_rent_centavos' => ['nullable', 'integer', 'between:0,100000000'],
            'max_rent_centavos' => ['nullable', 'integer', 'between:0,100000000'],
            'available_only' => ['nullable', 'boolean'],
            'inventory_type' => ['nullable', Rule::in(['bedspace', 'whole_room'])],
            'amenities' => ['nullable', 'array', 'max:6'],
            'amenities.*' => ['string', 'distinct', Rule::in(config('discovery.amenities'))],
            'radius_km' => ['nullable', 'numeric', Rule::in([0.5, 1, 2, 5])],
            'south' => ['nullable', 'required_with:north,west,east', 'numeric', 'between:-90,90'],
            'north' => ['nullable', 'required_with:south,west,east', 'numeric', 'between:-90,90', 'gt:south'],
            'west' => ['nullable', 'required_with:south,north,east', 'numeric', 'between:-180,180'],
            'east' => ['nullable', 'required_with:south,north,west', 'numeric', 'between:-180,180', 'gt:west'],
            'sort' => ['nullable', Rule::in(['newest', 'rent_asc', 'rent_desc', 'distance', 'recommended'])],
            'campus_id' => ['nullable', 'integer', Rule::exists('campuses', 'id')->where('active', true)],
        ]);
        if (isset($data['min_rent_centavos'], $data['max_rent_centavos']) && $data['max_rent_centavos'] < $data['min_rent_centavos']) {
            throw ValidationException::withMessages(['max_rent_centavos' => 'Maximum rent must be at least the minimum rent.']);
        }
        if (in_array($data['sort'] ?? '', ['rent_asc', 'rent_desc'], true) && empty($data['price_basis'])) {
            throw ValidationException::withMessages(['price_basis' => 'Choose per person or per room before sorting prices.']);
        }

        if ((isset($data['radius_km']) || in_array($data['sort'] ?? '', ['distance', 'recommended'], true)) && empty($data['campus_id'])) {
            throw ValidationException::withMessages(['campus_id' => 'Select a campus before filtering or sorting by campus distance.']);
        }

        return $data;
    }

    public static function options(Builder|Relation $query, array $data): void
    {
        AvailabilityFreshness::visibleOptions($query);
        if (! empty($data['inventory_type'])) {
            $query->where('inventory_type', $data['inventory_type']);
        }
        if (! empty($data['price_basis'])) {
            $query->where('price_basis', $data['price_basis']);
        }
        if (isset($data['min_rent_centavos'])) {
            $query->where('monthly_rent_centavos', '>=', $data['min_rent_centavos']);
        }
        if (isset($data['max_rent_centavos'])) {
            $query->where('monthly_rent_centavos', '<=', $data['max_rent_centavos']);
        }
        if ($data['available_only'] ?? false) {
            $query->where('available_units', '>', 0)->where('availability_confirmed_at', '>', $data['availability_cutoff']);
        }
    }

    public static function query(array $data): Builder
    {
        $data['availability_cutoff'] = now()->subDays(AvailabilityFreshness::REMIND_DAYS);
        $campus = CampusDistance::reference($data['campus_id'] ?? null);
        $query = CampusDistance::annotate(ListingController::publicQuery(), $campus);
        $query->whereHas('roomOptions', function (Builder $options): void {
            AvailabilityFreshness::visibleOptions($options);
            $options->where('available_units', '>', 0);
        });
        if (isset($data['radius_km'])) {
            CampusDistance::within($query, $campus, (float) $data['radius_km'] * 1000);
        }
        if (isset($data['south'])) {
            $query->whereBetween('latitude', [$data['south'], $data['north']])->whereBetween('longitude', [$data['west'], $data['east']]);
        }
        foreach ($data['amenities'] ?? [] as $amenity) {
            $query->whereJsonContains('amenities', $amenity);
        }
        $query->with(['roomOptions' => function ($options) use ($data): void {
            self::options($options, $data);
            $options->reorder()->orderBy('monthly_rent_centavos')->orderBy('id');
        }, 'roomOptions.fees', 'photos' => fn ($photos) => $photos->where('status', 'ready')]);
        $query->whereHas('roomOptions', fn ($options) => self::options($options, $data));
        if (! empty($data['property_type'])) {
            $query->where('property_type', $data['property_type']);
        }
        if (filled($data['q'] ?? null)) {
            $search = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($data['q'])).'%';
            $query->where(function (Builder $query) use ($search): void {
                $query->where('title', 'ilike', $search)->orWhere('city', 'ilike', $search)->orWhere('address', 'ilike', $search);
            });
        }
        $rent = RoomOption::query()->selectRaw('min(monthly_rent_centavos)')->whereColumn('property_id', 'properties.id');
        self::options($rent, $data);
        $query->addSelect(['matching_rent_centavos' => $rent]);
        $sort = $data['sort'] ?? 'newest';
        if ($sort === 'recommended') {
            $fresh = RoomOption::query()->selectRaw('count(*)')->whereColumn('property_id', 'properties.id')->where('available_units', '>', 0)->where('availability_confirmed_at', '>', $data['availability_cutoff']);
            self::options($fresh, $data);
            $query->addSelect(['fresh_available_options' => $fresh])->orderByRaw('(('.$fresh->toSql().') > 0) DESC', $fresh->getBindings())->orderByDesc('has_coordinates')->orderBy('distance_meters');
        } elseif ($sort === 'distance') {
            $query->orderByDesc('has_coordinates')->orderBy('distance_meters');
        } elseif (in_array($sort, ['rent_asc', 'rent_desc'], true)) {
            $query->orderBy('matching_rent_centavos', $sort === 'rent_asc' ? 'asc' : 'desc');
        }

        return $query->orderByDesc('approved_at')->orderByDesc('properties.id');
    }
}
