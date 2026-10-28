<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;

class PropertyLocation
{
    public static function usable(mixed $latitude, mixed $longitude): bool
    {
        return is_numeric($latitude) && is_numeric($longitude)
            && $latitude >= 4 && $latitude <= 22 && $longitude >= 116 && $longitude <= 127.5;
    }

    public static function summary(mixed $latitude, mixed $longitude): array
    {
        $missing = $latitude === null && $longitude === null;
        $usable = self::usable($latitude, $longitude);

        return ['status' => $usable ? 'within_service_area' : ($missing ? 'missing' : 'needs_correction'), 'can_map' => $usable];
    }

    public static function mapped(Builder $query): Builder
    {
        return $query->whereBetween('latitude', [4, 22])->whereBetween('longitude', [116, 127.5]);
    }

    public static function suspicious(Builder $query): Builder
    {
        return $query->where(fn (Builder $present) => $present->whereNotNull('latitude')->orWhereNotNull('longitude'))
            ->where(fn (Builder $invalid) => $invalid->whereNull('latitude')->orWhereNull('longitude')->orWhereNotBetween('latitude', [4, 22])->orWhereNotBetween('longitude', [116, 127.5]));
    }
}
