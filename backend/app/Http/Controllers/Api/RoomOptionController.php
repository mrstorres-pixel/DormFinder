<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RoomOptionRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Models\RoomOption;
use App\Services\ListingWorkflow;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class RoomOptionController extends Controller
{
    public function store(RoomOptionRequest $request, Property $property, ListingWorkflow $workflow): PropertyResource
    {
        return $this->save($request, $property, $workflow);
    }

    public function update(RoomOptionRequest $request, Property $property, RoomOption $roomOption, ListingWorkflow $workflow): PropertyResource
    {
        abort_unless($roomOption->property_id === $property->id, 404);

        return $this->save($request, $property, $workflow, $roomOption);
    }

    private function save(RoomOptionRequest $request, Property $property, ListingWorkflow $workflow, ?RoomOption $roomOption = null): PropertyResource
    {
        Gate::authorize('view', $property);
        $updated = DB::transaction(function () use ($request, $property, $workflow, $roomOption): Property {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            Gate::authorize('update', $locked);
            abort_unless($locked->revision === $request->integer('revision'), 409);
            $duplicate = $locked->roomOptions()->whereRaw('lower(name) = lower(?)', [trim($request->string('name')->toString())]);
            if ($roomOption) {
                $duplicate->where('id', '!=', $roomOption->id);
                $roomOption = $locked->roomOptions()->findOrFail($roomOption->id);
            }
            if ($duplicate->exists()) {
                throw ValidationException::withMessages(['name' => 'Use a different name for each room option.']);
            }
            if (! $roomOption && $locked->roomOptions()->count() >= 20) {
                throw ValidationException::withMessages(['name' => 'A listing can have up to twenty room options.']);
            }
            $values = $request->safe()->except(['revision', 'fees']);
            $values['name'] = trim($values['name']);
            $values['availability_confirmed_at'] = now();
            if ($roomOption) {
                $roomOption->update($values);
            } else {
                $roomOption = $locked->roomOptions()->create($values);
            }
            $roomOption->fees()->delete();
            $roomOption->fees()->createMany($request->validated('fees'));
            $workflow->demote($locked);

            return $locked;
        });

        return new PropertyResource($updated->load(['roomOptions.fees', 'photos' => fn ($query) => $query->where('status', 'ready')]));
    }

    public function destroy(Request $request, Property $property, RoomOption $roomOption, ListingWorkflow $workflow): PropertyResource
    {
        Gate::authorize('view', $property);
        abort_unless($roomOption->property_id === $property->id, 404);
        $request->validate(['revision' => ['required', 'integer', 'min:1']]);
        $updated = DB::transaction(function () use ($request, $property, $roomOption, $workflow): Property {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            Gate::authorize('update', $locked);
            abort_unless($locked->revision === $request->integer('revision'), 409);
            $locked->roomOptions()->findOrFail($roomOption->id)->delete();
            $workflow->demote($locked);

            return $locked;
        });

        return new PropertyResource($updated->load(['roomOptions.fees', 'photos' => fn ($query) => $query->where('status', 'ready')]));
    }
}
