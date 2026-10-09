<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PropertyResource;
use App\Models\ListingReview;
use App\Models\Property;
use App\Services\ListingWorkflow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ReviewController extends Controller
{
    public function submit(Request $request, Property $property, ListingWorkflow $workflow): PropertyResource
    {
        Gate::authorize('view', $property);
        $request->validate(['revision' => ['required', 'integer', 'min:1'], 'inventory_confirmed' => ['required', 'accepted']]);
        $updated = DB::transaction(function () use ($request, $property, $workflow): Property {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            Gate::authorize('update', $locked);
            abort_unless(in_array($locked->status, ['draft', 'rejected'], true) && $locked->revision === $request->integer('revision'), 409);
            $workflow->assertComplete($locked);
            $locked->status = 'pending_review';
            $locked->submitted_at = now();
            $locked->approved_at = null;
            $locked->moderation_reason = null;
            $locked->revision++;
            $locked->save();

            return $locked;
        });

        return new PropertyResource($updated->load(ListingController::relations()));
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->role === 'admin', 403);
        $request->validate(['page' => ['nullable', 'integer', 'min:1']]);

        return PropertyResource::collection(Property::query()->where('status', 'pending_review')->with(ListingController::relations())->oldest('submitted_at')->paginate(12));
    }

    public function show(Request $request, Property $property): PropertyResource
    {
        abort_unless($request->user()->role === 'admin', 403);

        return new PropertyResource($property->load(ListingController::relations()));
    }

    public function decide(Request $request, Property $property, ListingWorkflow $workflow): PropertyResource
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'reason' => ['required_if:decision,rejected', 'nullable', 'string', 'max:2000'],
            'review_confirmed' => ['required', 'accepted'],
        ]);
        $updated = DB::transaction(function () use ($request, $property, $data, $workflow): Property {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            abort_unless($locked->status === 'pending_review' && $locked->revision === $request->integer('revision'), 409);
            abort_unless($locked->landlord->status === 'active', 409);
            if ($data['decision'] === 'approved') {
                $workflow->assertComplete($locked);
            }
            ListingReview::query()->create(['property_id' => $locked->id, 'administrator_id' => $request->user()->id, 'revision' => $locked->revision, 'decision' => $data['decision'], 'reason' => $data['reason'] ?? null]);
            $locked->status = $data['decision'];
            $locked->moderation_reason = $data['reason'] ?? null;
            $locked->approved_at = $data['decision'] === 'approved' ? now() : null;
            $locked->revision++;
            $locked->save();

            return $locked;
        });

        return new PropertyResource($updated->load(ListingController::relations()));
    }
}
