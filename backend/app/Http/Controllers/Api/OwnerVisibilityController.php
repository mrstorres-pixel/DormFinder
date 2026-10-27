<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Services\ActivityRecorder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class OwnerVisibilityController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request, Property $property): PropertyResource
    {
        Gate::authorize('view', $property);
        $data = $request->validate(['action' => ['required', Rule::in(['pause'])], 'revision' => ['required', 'integer', 'min:1']]);
        $updated = DB::transaction(function () use ($request, $property, $data): Property {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            Gate::authorize('view', $locked);
            abort_unless($locked->status === 'approved' && ! $locked->owner_paused && $locked->revision === $data['revision'], 409);
            $locked->owner_paused = true;
            $locked->revision++;
            $locked->save();
            app(ActivityRecorder::class)->audit($request->user()->id, 'listing_pause', 'approved', 'paused', $locked->revision, 'Owner paused advertising; conversations and existing viewing requests are retained.', $locked->id);

            return $locked;
        });

        return new PropertyResource($updated->load(ListingController::relations()));
    }
}
