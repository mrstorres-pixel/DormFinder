<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, string $role): JsonResponse
    {
        abort_unless(in_array($role, ['student', 'landlord'], true), 404);
        abort_if($request->user(), 409);
        $user = new User($request->safe()->only(['name', 'email', 'password']));
        $user->role = $role;
        $user->status = 'active';
        $user->save();
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function login(Request $request): UserResource
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $credentials['email'] = mb_strtolower(trim($credentials['email']));
        $credentials['status'] = 'active';
        if (! Auth::guard('web')->attempt($credentials)) {
            throw ValidationException::withMessages(['email' => 'The email or password is incorrect, or this account is unavailable.']);
        }
        $request->session()->regenerate();

        return new UserResource($request->user());
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function update(Request $request): UserResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['prohibited'], 'role' => ['prohibited'], 'status' => ['prohibited'],
        ]);
        $request->user()->update($data);

        return new UserResource($request->user());
    }

    public function password(Request $request): Response
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:web'],
            'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()],
        ]);
        DB::transaction(function () use ($request, $data): void {
            $request->user()->password = $data['password'];
            $request->user()->remember_token = null;
            $request->user()->save();
            DB::table('sessions')->where('user_id', $request->user()->id)->delete();
        });

        return $this->logout($request);
    }
}
