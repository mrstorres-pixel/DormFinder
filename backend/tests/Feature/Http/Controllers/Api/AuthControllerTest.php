<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestWith(['student'])]
    #[TestWith(['landlord'])]
    public function test_registers_the_role_from_the_route_and_hashes_the_password(string $role): void
    {
        $response = $this->postJson('/api/v1/auth/register/'.$role, [
            'name' => 'Demo Member', 'email' => 'DEMO@example.test',
            'password' => 'TestingPass1234', 'password_confirmation' => 'TestingPass1234',
        ]);

        $response->assertCreated()->assertJsonPath('data.role', $role)->assertJsonPath('data.email', 'demo@example.test');
        $this->assertDatabaseHas('users', ['email' => 'demo@example.test', 'role' => $role]);
        $this->assertTrue(Hash::check('TestingPass1234', User::firstOrFail()->password));
        $response->assertJsonMissingPath('data.password');
        $this->assertAuthenticated();
    }

    public function test_rejects_client_supplied_admin_role_with_422(): void
    {
        $response = $this->postJson('/api/v1/auth/register/student', [
            'name' => 'Escalation', 'email' => 'test@example.test', 'role' => 'admin',
            'password' => 'TestingPass1234', 'password_confirmation' => 'TestingPass1234',
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_has_no_administrator_registration_endpoint(): void
    {
        $this->postJson('/api/v1/auth/register/admin')->assertNotFound();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_rejects_duplicate_email_case_variants_with_422(): void
    {
        User::factory()->create(['email' => 'member@example.test']);

        $this->postJson('/api/v1/auth/register/student', [
            'name' => 'Duplicate', 'email' => 'MEMBER@example.test',
            'password' => 'TestingPass1234', 'password_confirmation' => 'TestingPass1234',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('users', 1);
    }

    public function test_logs_in_an_active_user(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('data.id', $user->id);
        $this->assertAuthenticatedAs($user);
    }

    public function test_rejects_a_suspended_login_without_revealing_account_status(): void
    {
        $user = User::factory()->suspended()->create();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertUnprocessable()->assertJsonPath('errors.email.0', 'The email or password is incorrect, or this account is unavailable.');
        $this->assertGuest('web');
    }

    public function test_logout_ends_authentication(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->assertGuest('web');
    }

    public function test_requires_authentication_for_profile(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
    }

    public function test_rejects_suspended_authenticated_accounts(): void
    {
        $this->actingAs(User::factory()->suspended()->create())->getJson('/api/v1/me')->assertForbidden();
        $this->assertGuest('web');
    }

    public function test_profile_cannot_change_role(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson('/api/v1/me', ['name' => 'New Name', 'role' => 'admin'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->assertSame('student', $user->fresh()->role);
    }

    public function test_password_change_requires_current_password_and_logs_out(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson('/api/v1/me/password', [
            'current_password' => 'password', 'password' => 'ChangedPass1234', 'password_confirmation' => 'ChangedPass1234',
        ])->assertNoContent();
        $this->assertTrue(Hash::check('ChangedPass1234', $user->fresh()->password));
        $this->assertGuest('web');
    }

    public function test_wrong_current_password_preserves_the_account_and_session(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson('/api/v1/me/password', [
            'current_password' => 'incorrect', 'password' => 'ChangedPass1234', 'password_confirmation' => 'ChangedPass1234',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
        $this->assertAuthenticatedAs($user, 'web');
    }
}
