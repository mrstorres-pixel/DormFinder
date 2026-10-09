<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PropertyRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Services\ListingWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PropertyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Property::class);

        return PropertyResource::collection(
            $request->user()->properties()->with(ListingController::relations())
                ->latest('id')->paginate(12)
        );
    }

    public function store(PropertyRequest $request): JsonResponse
    {
        Gate::authorize('create', Property::class);
        $property = $request->user()->properties()->create($request->safe()->except('revision'));

        return (new PropertyResource($property->fresh()->load(ListingController::relations())))->response()->setStatusCode(201);
    }

    public function show(Property $property): PropertyResource
    {
        Gate::authorize('view', $property);

        return new PropertyResource($property->load(ListingController::relations()));
    }

    public function update(PropertyRequest $request, Property $property, ListingWorkflow $workflow): PropertyResource
    {
        Gate::authorize('view', $property);
        $property = DB::transaction(function () use ($request, $property, $workflow): Property {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            Gate::authorize('update', $locked);
            abort_unless($locked->revision === $request->integer('revision'), 409);
            $locked->fill($request->safe()->except('revision'));
            $workflow->demote($locked);

            return $locked;
        });

        return new PropertyResource($property->load(ListingController::relations()));
    }
}
