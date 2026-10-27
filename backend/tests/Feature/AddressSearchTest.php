<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AddressSearchTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function owner(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'landlord']));
        Http::preventStrayRequests();
    }

    private function feature(array $properties = [], array $point = [120.99, 14.6]): array
    {
        return ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => $point], 'properties' => [...['name' => 'Student Residence', 'street' => 'College Street', 'housenumber' => '12', 'city' => 'Manila', 'countrycode' => 'PH'], ...$properties]];
    }

    public function test_search_requires_an_active_landlord_without_sending_unauthorized_queries(): void
    {
        Http::fake();
        $this->getJson('/api/v1/landlord/address-search?q=College%20Street')->assertUnauthorized();
        foreach (['student', 'admin'] as $role) {
            $this->app['auth']->forgetGuards();
            $this->actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/v1/landlord/address-search?q=College%20Street')->assertForbidden();
        }
        Http::assertNothingSent();
    }

    public function test_invalid_queries_are_rejected_before_geocoding(): void
    {
        $this->owner();
        foreach (['', 'ab', '   ', str_repeat('x', 201)] as $query) {
            $this->getJson('/api/v1/landlord/address-search?'.http_build_query(['q' => $query]))->assertUnprocessable();
        }
        Http::assertNothingSent();
    }

    public function test_address_results_are_bounded_to_the_philippines_and_normalized_queries_are_cached(): void
    {
        $this->owner();
        Http::fake(['photon.komoot.io/*' => Http::response(['features' => [$this->feature(), $this->feature(['countrycode' => 'DE']), $this->feature([], [13, 52]), null, $this->feature(['countrycode' => []])]])]);
        $this->getJson('/api/v1/landlord/address-search?q=College%20%20Street%20Manila')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.latitude', 14.6)->assertJsonPath('data.0.longitude', 120.99)->assertJsonPath('data.0.label', 'Student Residence, 12 College Street, Manila');
        $this->getJson('/api/v1/landlord/address-search?q=college%20street%20manila')->assertOk()->assertJsonCount(1, 'data');
        Http::assertSentCount(1);
        Http::assertSent(fn ($request): bool => $request['q'] === 'College Street Manila' && $request['countrycode'] === 'PH' && $request['limit'] === 5 && ! $request->hasHeader('Authorization') && str_contains($request->header('User-Agent')[0], 'DormFinder'));
    }

    public function test_empty_results_are_valid_and_cached(): void
    {
        $this->owner();
        Http::fake(['photon.komoot.io/*' => Http::response(['features' => []])]);
        for ($index = 0; $index < 2; $index++) {
            $this->getJson('/api/v1/landlord/address-search?q=Unknown%20Street')->assertOk()->assertJsonCount(0, 'data');
        }
        Http::assertSentCount(1);
    }

    public function test_provider_failure_does_not_poison_retry_results(): void
    {
        $this->owner();
        Http::fake(['photon.komoot.io/*' => Http::sequence()->push('Unavailable', 503)->push(['features' => [$this->feature()]])]);
        $this->getJson('/api/v1/landlord/address-search?q=College%20Street')->assertServiceUnavailable();
        Cache::forget('address-search:next-request');
        $this->getJson('/api/v1/landlord/address-search?q=College%20Street')->assertOk()->assertJsonCount(1, 'data');
        Http::assertSentCount(2);
    }

    public function test_invalid_provider_payloads_fail_with_the_map_fallback(): void
    {
        $this->owner();
        foreach ([['features' => 'bad'], ['features' => ['unexpected' => $this->feature()]], str_repeat('x', 100001)] as $payload) {
            Http::fake(['photon.komoot.io/*' => Http::response($payload)]);
            Cache::forget('address-search:next-request');
            $this->getJson('/api/v1/landlord/address-search?q=College%20Street')->assertServiceUnavailable()->assertJsonPath('message', 'Address search is temporarily unavailable. You can still click the map to place your pin.');
        }
    }

    public function test_shared_spacing_and_daily_budget_do_not_send_excess_requests(): void
    {
        $this->owner();
        Http::fake();
        Cache::put('address-search:next-request', microtime(true) + 10, 60);
        $this->getJson('/api/v1/landlord/address-search?q=College%20Street')->assertTooManyRequests()->assertHeader('Retry-After', '2');
        Cache::forget('address-search:next-request');
        Cache::put('address-search:daily:'.now()->format('Y-m-d'), 250, 60);
        $this->getJson('/api/v1/landlord/address-search?q=College%20Street')->assertServiceUnavailable();
        Http::assertNothingSent();
    }
}
