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
            'sort' => ['nullable', Rule::in(['newest', 'rent_asc', 'rent_desc', 'distance'])],
            'campus_id' => ['nullable', 'integer', Rule::exists('campuses', 'id')->where('active', true)],
        ]);
        if (isset($data['min_rent_centavos'], $data['max_rent_centavos']) && $data['max_rent_centavos'] < $data['min_rent_centavos']) {
            throw ValidationException::withMessages(['max_rent_centavos' => 'Maximum rent must be at least the minimum rent.']);
        }
        if (in_array($data['sort'] ?? '', ['rent_asc', 'rent_desc'], true) && empty($data['price_basis'])) {
            throw ValidationException::withMessages(['price_basis' => 'Choose per person or per room before sorting prices.']);
        }

        return $data;
    }

    public static function options(Builder|Relation $query, array $data): void
    {
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
            $query->where('available_units', '>', 0)->where('availability_confirmed_at', '>=', $data['availability_cutoff']);
        }
    }

    public static function query(array $data): Builder
    {
        $data['availability_cutoff'] = now()->subDays(14);
        $query = CampusDistance::annotate(ListingController::publicQuery(), CampusDistance::reference($data['campus_id'] ?? null));
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
        if ($sort === 'distance') {
            $query->orderByDesc('has_coordinates')->orderBy('distance_meters');
        } elseif (in_array($sort, ['rent_asc', 'rent_desc'], true)) {
            $query->orderBy('matching_rent_centavos', $sort === 'rent_asc' ? 'asc' : 'desc');
        }

        return $query->orderByDesc('approved_at')->orderByDesc('properties.id');
    }
}
