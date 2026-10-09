<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PhotoRequest;
use App\Http\Resources\PhotoResource;
use App\Models\Property;
use App\Models\PropertyPhoto;
use App\Services\PhotoStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PhotoController extends Controller
{
    public function store(PhotoRequest $request, Property $property, PhotoStorage $storage): JsonResponse
    {
        Gate::authorize('view', $property);
        $photo = $storage->upload($property, $request->file('photo'), $request->validated());

        return (new PhotoResource($photo))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Property $property, PropertyPhoto $photo, PhotoStorage $storage): JsonResponse
    {
        Gate::authorize('view', $property);
        abort_unless($photo->property_id === $property->id, 404);
        $request->validate(['revision' => ['required', 'integer', 'min:1']]);
        DB::transaction(function () use ($property, $photo, $request): void {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            Gate::authorize('update', $locked);
            abort_unless($locked->revision === $request->integer('revision'), 409);
            $photo->update(['status' => 'pending_deletion']);
            $locked->status = 'draft';
            $locked->approved_at = null;
            $locked->revision++;
            $locked->save();
        });
        $deleted = $storage->delete($photo);

        return response()->json(['data' => ['deleted' => $deleted, 'pending_cleanup' => ! $deleted]], $deleted ? 200 : 202);
    }

    public function local(Request $request, PropertyPhoto $photo): StreamedResponse
    {
        abort_unless($request->hasValidRelativeSignature(), 403);
        abort_unless($photo->disk === 'local' && $photo->status === 'ready', 404);
        abort_unless(Storage::disk('local')->exists($photo->storage_key), 404);

        return Storage::disk('local')->response($photo->storage_key, null, [
            'Content-Type' => 'image/jpeg', 'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
