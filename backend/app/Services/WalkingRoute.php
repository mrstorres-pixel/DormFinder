<?php

namespace App\Services;

use App\Models\Campus;
use App\Models\Property;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class WalkingRoute
{
    /** @return array{status: int, body: array} */
    public function between(Property $property, Campus $campus): array
    {
        $points = [$property->longitude, $property->latitude, $campus->longitude, $campus->latitude];
        foreach ($points as $index => $value) {
            if (! is_numeric($value) || ! is_finite((float) $value) || abs($value) > ($index % 2 === 0 ? 180 : 90)) {
                return $this->unavailable('This listing has no usable location pin.', 422);
            }
        }
        $latitudeDelta = deg2rad($campus->latitude - $property->latitude);
        $longitudeDelta = deg2rad($campus->longitude - $property->longitude);
        $a = sin($latitudeDelta / 2) ** 2 + cos(deg2rad($property->latitude)) * cos(deg2rad($campus->latitude)) * sin($longitudeDelta / 2) ** 2;
        if (6371000 * 2 * asin(sqrt(min(1, $a))) > 10000) {
            return $this->unavailable('Walking estimates are available within 10 km of campus.', 422);
        }

        $key = 'walking:v1:'.hash('sha256', json_encode($points));
        $cached = Cache::get($key);
        if ($cached !== null) {
            return $cached;
        }
        $lock = Cache::lock('walking:provider-lock', 20);
        if (! $lock->get()) {
            return $this->unavailable('Walking routes are busy. Please try again in a moment.', 429);
        }
        try {
            if (Cache::get('walking:next-request', 0) > microtime(true)) {
                return $this->unavailable('Walking routes are busy. Please try again in a moment.', 429);
            }
            $dayKey = 'walking:daily:'.now()->format('Y-m-d');
            if (Cache::get($dayKey, 0) >= 250) {
                return $this->unavailable('Today’s free walking-route allowance is reached. Previously loaded routes remain available.', 503);
            }
            Cache::put($dayKey, Cache::get($dayKey, 0) + 1, now()->addDays(2));
            try {
                $coordinates = sprintf('%.7F,%.7F;%.7F,%.7F', ...$points);
                $reply = Http::acceptJson()->withUserAgent('DormFinder/1.0 (https://dormfinder-pink.vercel.app)')
                    ->connectTimeout(3)->timeout(10)->withOptions(['allow_redirects' => false])
                    ->get('https://routing.openstreetmap.de/routed-foot/route/v1/foot/'.$coordinates, [
                        'overview' => 'full', 'geometries' => 'geojson', 'steps' => 'false',
                        'alternatives' => 'false', 'radiuses' => '100;100', 'generate_hints' => 'false',
                    ]);
                $payload = strlen($reply->body()) <= 1000000 ? $reply->json() : null;
                if (is_array($payload) && in_array($payload['code'] ?? '', ['NoRoute', 'NoSegment'], true)) {
                    $result = $this->unavailable('No mapped walking route was found near these pins. Confirm access with the owner.', 422);
                } elseif (! $reply->successful() || ! $this->valid($payload)) {
                    $result = $this->unavailable('Walking directions are temporarily unavailable. Please try again later.', 503);
                } else {
                    $route = $payload['routes'][0];
                    $result = ['status' => 200, 'body' => ['data' => [
                        'distance_meters' => (int) round($route['distance']),
                        'duration_seconds' => (int) round($route['duration']),
                        'geometry' => $route['geometry'],
                        'endpoint_offsets_meters' => array_map(fn (array $point): int => (int) round($point['distance']), $payload['waypoints']),
                        'provider' => 'FOSSGIS / OSRM (foot)',
                    ]]];
                }
            } catch (ConnectionException) {
                $result = $this->unavailable('Walking directions are temporarily unavailable. Please try again later.', 503);
            } finally {
                // Shared across all workers: leave a full second after every outbound request, including failures.
                Cache::put('walking:next-request', microtime(true) + 1.1, 60);
            }
            Cache::put($key, $result, $result['status'] === 200 ? 86400 : ($result['status'] === 422 ? 600 : 30));

            return $result;
        } finally {
            $lock->release();
        }
    }

    private function valid(mixed $payload): bool
    {
        if (! is_array($payload) || ($payload['code'] ?? '') !== 'Ok') {
            return false;
        }
        $route = $payload['routes'][0] ?? [];
        if (! is_array($route)) {
            return false;
        }
        foreach (['distance', 'duration'] as $field) {
            if (! is_numeric($route[$field] ?? null) || ! is_finite((float) $route[$field]) || $route[$field] < 0 || $route[$field] > 100000) {
                return false;
            }
        }
        $coordinates = $route['geometry']['coordinates'] ?? null;
        if (($route['geometry']['type'] ?? '') !== 'LineString' || ! is_array($coordinates) || count($coordinates) < 2 || count($coordinates) > 20000) {
            return false;
        }
        foreach ($coordinates as $point) {
            if (! is_array($point) || count($point) !== 2 || ! is_numeric($point[0] ?? null) || ! is_numeric($point[1] ?? null)
                || ! is_finite((float) $point[0]) || ! is_finite((float) $point[1]) || abs($point[0]) > 180 || abs($point[1]) > 90) {
                return false;
            }
        }
        $waypoints = $payload['waypoints'] ?? null;
        if (! is_array($waypoints) || count($waypoints) !== 2) {
            return false;
        }
        foreach ($waypoints as $point) {
            if (! is_array($point) || ! is_numeric($point['distance'] ?? null) || ! is_finite((float) $point['distance']) || $point['distance'] < 0 || $point['distance'] > 100) {
                return false;
            }
        }

        return true;
    }

    /** @return array{status: int, body: array} */
    private function unavailable(string $message, int $status): array
    {
        return ['status' => $status, 'body' => ['message' => $message]];
    }
}
