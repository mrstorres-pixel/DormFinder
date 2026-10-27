<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Property;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AddressSearchController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Property::class);
        $data = $request->validate(['q' => ['required', 'string', 'min:3', 'max:200']]);
        $query = preg_replace('/\s+/u', ' ', trim($data['q']));
        abort_if(mb_strlen($query) < 3, 422, 'Enter at least three characters of the address.');
        $endpoint = config('services.geocoding.url');
        $key = 'address-search:v1:'.hash('sha256', $endpoint.'|'.mb_strtolower($query));
        $cached = Cache::get($key);
        if ($cached !== null) {
            return response()->json(['data' => $cached]);
        }
        $lock = Cache::lock('address-search:provider-lock', 15);
        if (! $lock->get()) {
            return $this->unavailable(429);
        }
        try {
            if (Cache::get('address-search:next-request', 0) > microtime(true)) {
                return $this->unavailable(429);
            }
            $dayKey = 'address-search:daily:'.now()->format('Y-m-d');
            if (Cache::get($dayKey, 0) >= 250) {
                return $this->unavailable();
            }
            Cache::put($dayKey, Cache::get($dayKey, 0) + 1, now()->addDays(2));
            try {
                $reply = Http::acceptJson()->withUserAgent('DormFinder/1.0 (https://dormfinder-pink.vercel.app)')
                    ->connectTimeout(3)->timeout(8)->withOptions(['allow_redirects' => false])
                    ->get($endpoint, ['q' => $query, 'limit' => 5, 'lang' => 'en', 'countrycode' => 'PH']);
                $payload = strlen($reply->body()) <= 100000 ? $reply->json() : null;
                if (! $reply->successful() || ! is_array($payload['features'] ?? null) || ! array_is_list($payload['features'])) {
                    return $this->unavailable();
                }
                $results = [];
                foreach (array_slice($payload['features'], 0, 5) as $feature) {
                    if (! is_array($feature)) {
                        continue;
                    }
                    $point = $feature['geometry']['coordinates'] ?? [];
                    $place = $feature['properties'] ?? [];
                    if (! is_array($place)) {
                        continue;
                    }
                    $place = array_filter($place, 'is_string');
                    if (($feature['geometry']['type'] ?? '') !== 'Point' || ! is_array($place)
                        || ! is_numeric($point[0] ?? null) || ! is_numeric($point[1] ?? null)
                        || $point[0] < 116 || $point[0] > 127.5 || $point[1] < 4 || $point[1] > 22
                        || strtoupper($place['countrycode'] ?? '') !== 'PH') {
                        continue;
                    }
                    $parts = [$place['name'] ?? '', trim(($place['housenumber'] ?? '').' '.($place['street'] ?? '')), $place['district'] ?? '', $place['city'] ?? $place['county'] ?? '', $place['state'] ?? ''];
                    $label = implode(', ', array_unique(array_filter($parts, fn ($part): bool => is_string($part) && trim($part) !== '')));
                    if ($label !== '') {
                        $results[] = ['label' => Str::limit($label, 300), 'latitude' => (float) $point[1], 'longitude' => (float) $point[0]];
                    }
                }
                Cache::put($key, $results, count($results) ? 86400 : 600);

                return response()->json(['data' => $results]);
            } catch (ConnectionException) {
                return $this->unavailable();
            } finally {
                Cache::put('address-search:next-request', microtime(true) + 1.1, 60);
            }
        } finally {
            $lock->release();
        }
    }

    private function unavailable(int $status = 503): JsonResponse
    {
        return response()->json(['message' => $status === 429 ? 'Address search is busy. Try again in a moment, or place the pin on the map.' : 'Address search is temporarily unavailable. You can still click the map to place your pin.'], $status, ['Cache-Control' => 'no-store', ...($status === 429 ? ['Retry-After' => '2'] : [])]);
    }
}
