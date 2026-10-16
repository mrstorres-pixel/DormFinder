<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Property;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WalkingRouteTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function listing(array $attributes = []): Property
    {
        return Property::factory()->create([...['status' => 'approved', 'latitude' => 14.6, 'longitude' => 121.001], ...$attributes]);
    }

    private function payload(): array
    {
        return ['code' => 'Ok', 'routes' => [['distance' => 521.9, 'duration' => 419.4, 'geometry' => ['type' => 'LineString', 'coordinates' => [[121.001, 14.6], [121.0005, 14.6003], [121, 14.6]]]]], 'waypoints' => [['distance' => 12], ['distance' => 18]]];
    }

    private function url(Property $listing, Campus $campus): string
    {
        return '/api/v1/listings/'.$listing->id.'/walking-route?campus_id='.$campus->id;
    }

    public function test_public_walking_route_uses_foot_graph_and_caches_coordinate_pair(): void
    {
        Http::preventStrayRequests();
        Http::fake(['routing.openstreetmap.de/*' => Http::response($this->payload())]);
        $listing = $this->listing();
        $campus = Campus::factory()->create();
        $this->getJson($this->url($listing, $campus))->assertOk()->assertJsonPath('data.distance_meters', 522)->assertJsonPath('data.duration_seconds', 419)->assertJsonPath('data.geometry.type', 'LineString')->assertJsonPath('data.endpoint_offsets_meters', [12, 18]);
        $this->getJson($this->url($listing, $campus))->assertOk();
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_contains($request->url(), '/routed-foot/route/v1/foot/121.0010000,14.6000000;121.0000000,14.6000000')
            && $request['geometries'] === 'geojson' && $request['radiuses'] === '100;100' && str_contains($request->header('User-Agent')[0], 'DormFinder'));
        $listing->update(['latitude' => 14.6002]);
        Cache::forget('walking:next-request');
        $this->getJson($this->url($listing, $campus))->assertOk();
        Http::assertSentCount(2);
        $listing->forceFill(['status' => 'draft'])->save();
        $this->getJson($this->url($listing, $campus))->assertNotFound();
        Http::assertSentCount(2);
    }

    public function test_private_inactive_and_invalid_locations_never_reach_provider(): void
    {
        Http::preventStrayRequests();
        Http::fake();
        $campus = Campus::factory()->create();
        $draft = $this->listing(['status' => 'draft']);
        $this->getJson($this->url($draft, $campus))->assertNotFound();
        $suspended = $this->listing();
        $suspended->landlord->forceFill(['status' => 'suspended'])->save();
        $this->getJson($this->url($suspended, $campus))->assertNotFound();
        $listing = $this->listing(['latitude' => null, 'longitude' => null]);
        $this->getJson($this->url($listing, $campus))->assertUnprocessable();
        $listing->update(['latitude' => 15.6, 'longitude' => 121.001]);
        $this->getJson($this->url($listing, $campus))->assertUnprocessable();
        $campus->forceFill(['active' => false])->save();
        $this->getJson($this->url($listing, $campus))->assertUnprocessable()->assertJsonValidationErrors('campus_id');
        $this->getJson('/api/v1/listings/'.$listing->id.'/walking-route')->assertUnprocessable()->assertJsonValidationErrors('campus_id');
        Http::assertNothingSent();
    }

    public function test_shared_outbound_limit_applies_to_different_clients_and_failures(): void
    {
        Http::fake(['routing.openstreetmap.de/*' => Http::failedConnection()]);
        $campus = Campus::factory()->create();
        $listing = $this->listing();
        $this->getJson($this->url($listing, $campus))->assertServiceUnavailable();
        $this->getJson($this->url($listing, $campus))->assertServiceUnavailable();
        $other = $this->listing(['latitude' => 14.601]);
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.8'])->getJson($this->url($other, $campus))->assertTooManyRequests()->assertHeader('Retry-After', '2');
        Http::assertSentCount(1);
        Cache::forget('walking:next-request');
        Cache::put('walking:daily:'.now()->format('Y-m-d'), 250, 60);
        $this->getJson($this->url($other, $campus))->assertServiceUnavailable();
        Http::assertSentCount(1);
    }

    public function test_no_route_and_invalid_geometry_fail_honestly_and_release_lock(): void
    {
        $campus = Campus::factory()->create();
        $listing = $this->listing();
        $invalid = $this->payload();
        $invalid['routes'][0]['geometry']['coordinates'][0] = [999, 14.6];
        Http::fake(['routing.openstreetmap.de/*' => Http::sequence()->push(['code' => 'NoRoute'], 400)->push($invalid)]);
        $this->getJson($this->url($listing, $campus))->assertUnprocessable()->assertJsonMissingPath('data.duration_seconds');
        $this->getJson($this->url($listing, $campus))->assertUnprocessable();
        Http::assertSentCount(1);
        Cache::forget('walking:next-request');
        $listing->update(['latitude' => 14.601]);
        $this->getJson($this->url($listing, $campus))->assertServiceUnavailable()->assertJsonMissingPath('data');
        $lock = Cache::lock('walking:provider-lock', 20);
        $this->assertTrue($lock->get());
        $lock->release();
    }

    public function test_oversnapped_and_malformed_provider_payloads_are_not_shown_as_routes(): void
    {
        $campus = Campus::factory()->create();
        $listing = $this->listing();
        $payload = $this->payload();
        $payload['waypoints'][0]['distance'] = 500;
        Http::fake(['routing.openstreetmap.de/*' => Http::sequence()->push($payload)->push('not JSON')]);
        $this->getJson($this->url($listing, $campus))->assertServiceUnavailable();
        Cache::forget('walking:next-request');
        $listing->update(['latitude' => 14.601]);
        $this->getJson($this->url($listing, $campus))->assertServiceUnavailable();
    }

    public function test_locked_provider_does_not_make_outbound_request(): void
    {
        Http::fake();
        $lock = Cache::lock('walking:provider-lock', 20);
        $lock->get();
        $this->getJson($this->url($this->listing(), Campus::factory()->create()))->assertTooManyRequests();
        Http::assertNothingSent();
        $lock->release();
    }

    public function test_client_request_limit_also_bounds_cached_requests(): void
    {
        Http::fake(['routing.openstreetmap.de/*' => Http::response($this->payload())]);
        $url = $this->url($this->listing(), Campus::factory()->create());
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->getJson($url)->assertOk();
        }
        $this->getJson($url)->assertTooManyRequests();
        Http::assertSentCount(1);
    }
}
