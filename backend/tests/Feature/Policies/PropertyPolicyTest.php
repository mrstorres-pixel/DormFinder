<?php

namespace Tests\Feature\Policies;

use App\Models\Property;
use App\Models\User;
use App\Policies\PropertyPolicy;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class PropertyPolicyTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestWith(['landlord', 'active', true, true])]
    #[TestWith(['landlord', 'active', false, false])]
    #[TestWith(['student', 'active', true, false])]
    #[TestWith(['admin', 'active', true, false])]
    #[TestWith(['landlord', 'suspended', true, false])]
    public function test_private_owner_policy(string $role, string $status, bool $owns, bool $allowed): void
    {
        $user = User::factory()->create(['role' => $role, 'status' => $status]);
        $property = Property::factory()->create(['landlord_id' => $owns ? $user->id : User::factory()->landlord()->create()->id]);

        $response = (new PropertyPolicy)->view($user, $property);

        $this->assertSame($allowed, $response->allowed());
    }

    #[TestWith(['pending_review'])]
    #[TestWith(['suspended'])]
    #[TestWith(['archived'])]
    public function test_locked_states_cannot_be_edited(string $status): void
    {
        $property = Property::factory()->create(['status' => $status]);

        $this->assertSame(409, (new PropertyPolicy)->update($property->landlord, $property)->status());
    }
}
