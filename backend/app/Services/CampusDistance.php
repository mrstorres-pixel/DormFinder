<?php

namespace App\Services;

use App\Models\Campus;
use Illuminate\Database\Eloquent\Builder;

class CampusDistance
{
    public static function reference(?int $campusId = null): Campus
    {
        return Campus::query()->where('active', true)->when($campusId, fn ($query) => $query->whereKey($campusId), fn ($query) => $query->where('slug', 'tip-manila-casal'))->firstOrFail();
    }

    public static function annotate(Builder $query, Campus $campus): Builder
    {
        return $query->select('properties.*')->selectRaw('CAST(? AS bigint) AS distance_campus_id', [$campus->id])->selectRaw(
            '6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0, power(sin(radians((properties.latitude - ?)::double precision) / 2), 2) + cos(radians(?::double precision)) * cos(radians(properties.latitude::double precision)) * power(sin(radians((properties.longitude - ?)::double precision) / 2), 2))))) AS distance_meters',
            [$campus->latitude, $campus->latitude, $campus->longitude],
        )->selectRaw('(properties.latitude IS NOT NULL AND properties.longitude IS NOT NULL) AS has_coordinates');
    }
}
