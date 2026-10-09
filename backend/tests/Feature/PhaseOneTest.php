<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class PhaseOneTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_readiness_checks_the_database_without_exposing_configuration(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('data.status', 'ready')
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonMissingPath('password');
    }
}
