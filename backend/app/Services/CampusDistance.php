<?php

namespace App\Services;

use App\Models\Campus;
use Illuminate\Database\Eloquent\Builder;

class CampusDistance
{
    public static function reference(?int $campusId = null): ?Campus
    {
        return $campusId === null ? null : Campus::query()->where('active', true)->whereKey($campusId)->firstOrFail();
    }

    public static function within(Builder $query, Campus $campus, float $meters): void
    {
        $query->whereNotNull('latitude')->whereNotNull('longitude')->whereRaw(
            '6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0, power(sin(radians((properties.latitude - ?)::double precision) / 2), 2) + cos(radians(?::double precision)) * cos(radians(properties.latitude::double precision)) * power(sin(radians((properties.longitude - ?)::double precision) / 2), 2))))) <= ?',
            [$campus->latitude, $campus->latitude, $campus->longitude, $meters],
        );
    }

    public static function annotate(Builder $query, ?Campus $campus): Builder
    {
        if ($campus === null) {
            return $query->select('properties.*');
        }

        return $query->select('properties.*')->selectRaw('CAST(? AS bigint) AS distance_campus_id', [$campus->id])->selectRaw(
            '6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0, power(sin(radians((properties.latitude - ?)::double precision) / 2), 2) + cos(radians(?::double precision)) * cos(radians(properties.latitude::double precision)) * power(sin(radians((properties.longitude - ?)::double precision) / 2), 2))))) AS distance_meters',
            [$campus->latitude, $campus->latitude, $campus->longitude],
        )->selectRaw('(properties.latitude IS NOT NULL AND properties.longitude IS NOT NULL) AS has_coordinates');
    }
}
