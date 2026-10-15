<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\User;
use App\Services\PhotoStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AvatarController extends Controller
{
    private function key(User $user): string
    {
        return 'avatars/'.$user->id.'/profile.jpg';
    }

    public function info(Request $request): JsonResponse
    {
        try {
            $exists = Storage::disk()->exists($this->key($request->user()));
        } catch (\Throwable) {
            abort(503, 'Your profile photo could not be loaded.');
        }

        return response()->json(['data' => ['has_avatar' => $exists, 'avatar_url' => $request->user()->avatarUrl()]]);
    }

    public function store(Request $request, PhotoStorage $photos): JsonResponse
    {
        $request->validate(['photo' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:3072']]);
        $bytes = $photos->normalize($request->file('photo'), 512);
        try {
            $user = DB::transaction(function () use ($request, $bytes): User {
                $user = User::query()->lockForUpdate()->findOrFail($request->user()->id);
                if (! Storage::disk()->put($this->key($user), $bytes, ['ContentType' => 'image/jpeg', 'CacheControl' => 'private, no-store'])) {
                    throw new \RuntimeException('Avatar write failed.');
                }
                $user->touch();

                return $user;
            });
        } catch (\Throwable) {
            Log::warning('Avatar upload failed', ['user_id' => $request->user()->id]);
            abort(503, 'Your profile photo could not be saved. Please retry.');
        }

        return response()->json(['data' => ['has_avatar' => true, 'avatar_url' => $user->avatarUrl()]]);
    }

    public function destroy(Request $request): JsonResponse
    {
        try {
            $user = DB::transaction(function () use ($request): User {
                $user = User::query()->lockForUpdate()->findOrFail($request->user()->id);
                if (! Storage::disk()->delete($this->key($user))) {
                    throw new \RuntimeException('Avatar deletion failed.');
                }
                $user->touch();

                return $user;
            });
        } catch (\Throwable) {
            abort(503, 'Your profile photo could not be removed. Please retry.');
        }

        return response()->json(['data' => ['has_avatar' => false, 'avatar_url' => $user->avatarUrl()]]);
    }

    public function show(Request $request, User $user): Response|StreamedResponse
    {
        $viewer = $request->user();
        abort_unless($viewer->id === $user->id || Inquiry::query()->where(function ($query) use ($viewer, $user): void {
            $query->where('student_id', $viewer->id)->where('landlord_id', $user->id);
        })->orWhere(function ($query) use ($viewer, $user): void {
            $query->where('landlord_id', $viewer->id)->where('student_id', $user->id);
        })->exists(), 404);
        $headers = ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff'];
        try {
            if (Storage::disk()->exists($this->key($user))) {
                return Storage::disk()->response($this->key($user), null, ['Content-Type' => 'image/jpeg', ...$headers]);
            }
        } catch (\Throwable) {
            Log::warning('Avatar read failed', ['user_id' => $user->id]);
        }
        $initial = htmlspecialchars(mb_strtoupper(mb_substr(trim($user->name), 0, 1)), ENT_QUOTES | ENT_XML1, 'UTF-8');

        return response('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="#eaf0fc"/><text x="40" y="43" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#2558e5">'.$initial.'</text></svg>', 200, ['Content-Type' => 'image/svg+xml', 'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'", ...$headers]);
    }
}
