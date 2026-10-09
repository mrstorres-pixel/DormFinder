<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ModerationController extends Controller
{
    public function properties(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['status' => ['nullable', Rule::in(['draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived'])], 'page' => ['nullable', 'integer', 'between:1,100000']]);
        $query = Property::query()->with(ListingController::relations());
        if (filled($data['status'] ?? null)) {
            $query->where('status', $data['status']);
        }

        return PropertyResource::collection($query->orderByDesc('id')->paginate(12));
    }

    private function actionData(Request $request, array $actions): array
    {
        $request->merge(['reason' => is_string($request->input('reason')) ? trim($request->input('reason')) : $request->input('reason')]);

        return $request->validate(['revision' => ['required', 'integer', 'min:1'], 'action' => ['required', Rule::in($actions)], 'reason' => ['required', 'string', 'min:10', 'max:2000']]);
    }

    public function listing(Request $request, Property $property, ActivityRecorder $activity): PropertyResource
    {
        abort_unless($request->user()->role === 'admin', 403);

        return $this->changeListing($request, $property, $activity, false);
    }

    public function archive(Request $request, Property $property, ActivityRecorder $activity): PropertyResource
    {
        Gate::authorize('view', $property);

        return $this->changeListing($request, $property, $activity, true);
    }

    private function changeListing(Request $request, Property $property, ActivityRecorder $activity, bool $owner): PropertyResource
    {
        $data = $this->actionData($request, $owner ? ['archive', 'restore'] : ['suspend', 'archive', 'restore']);
        $updated = DB::transaction(function () use ($request, $property, $activity, $owner, $data): Property {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            if ($owner) {
                Gate::authorize('view', $locked);
            }
            abort_unless($locked->revision === $data['revision'], 409);
            $before = $locked->status;
            $valid = match ($data['action']) {
                'restore' => in_array($before, $owner ? ['archived'] : ['archived', 'suspended'], true),
                'suspend' => ! in_array($before, ['suspended', 'archived'], true),
                'archive' => ! in_array($before, $owner ? ['archived', 'suspended'] : ['archived'], true),
            };
            abort_unless($valid, 409);
            $locked->status = $data['action'] === 'restore' ? 'draft' : ($data['action'] === 'archive' ? 'archived' : 'suspended');
            $locked->approved_at = null;
            $locked->submitted_at = null;
            $locked->moderation_reason = $data['reason'];
            $locked->revision++;
            $locked->save();
            $audit = $activity->audit($request->user()->id, 'listing_'.$data['action'], $before, $locked->status, $locked->revision, $data['reason'], $locked->id);
            $activity->notify($locked->landlord_id, 'moderation:'.$audit, 'listing_moderation', 'Your listing is now '.$locked->status.'.', '/landlord/properties/'.$locked->id);

            return $locked;
        });

        return new PropertyResource($updated->load(ListingController::relations()));
    }

    public function users(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100'], 'status' => ['nullable', Rule::in(['active', 'suspended'])], 'page' => ['nullable', 'integer', 'between:1,100000']]);
        $query = User::query()->select(['id', 'name', 'email', 'role', 'status', 'moderation_revision'])->whereIn('role', ['student', 'landlord']);
        if (isset($data['id'])) {
            $query->where('id', $data['id']);
        }
        if (filled($data['q'] ?? null)) {
            $pattern = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower(trim($data['q']))).'%';
            $query->where(function ($query) use ($pattern): void {
                $query->whereRaw('lower(name) LIKE ?', [$pattern])->orWhereRaw('lower(email) LIKE ?', [$pattern]);
            });
        }
        if (filled($data['status'] ?? null)) {
            $query->where('status', $data['status']);
        }

        return response()->json($query->orderBy('id')->paginate(12));
    }

    public function account(Request $request, User $user, ActivityRecorder $activity): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        abort_if($user->role === 'admin' || $user->id === $request->user()->id, 403);
        $data = $this->actionData($request, ['suspend', 'reactivate']);
        $result = DB::transaction(function () use ($request, $user, $activity, $data): array {
            $properties = Property::query()->where('landlord_id', $user->id)->orderBy('id')->lockForUpdate()->get();
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            abort_if($locked->role === 'admin', 403);
            abort_unless((int) $locked->moderation_revision === $data['revision'], 409);
            $before = $locked->status;
            $after = $data['action'] === 'suspend' ? 'suspended' : 'active';
            abort_if($before === $after, 409);
            $locked->status = $after;
            $locked->moderation_revision++;
            $locked->remember_token = null;
            $locked->save();
            DB::table('sessions')->where('user_id', $locked->id)->delete();
            $audit = $activity->audit($request->user()->id, 'account_'.$data['action'], $before, $after, $locked->moderation_revision, $data['reason'], user: $locked->id);
            $hidden = 0;
            if ($after === 'suspended') {
                foreach ($properties as $property) {
                    if (in_array($property->status, ['approved', 'pending_review'], true)) {
                        $previous = $property->status;
                        $property->status = 'draft';
                        $property->approved_at = null;
                        $property->submitted_at = null;
                        $property->moderation_reason = 'Account suspended. Resubmit after reactivation.';
                        $property->revision++;
                        $property->save();
                        $activity->audit($request->user()->id, 'account_listing_hidden', $previous, 'draft', $property->revision, $data['reason'], $property->id, $locked->id);
                        $hidden++;
                    }
                }
            }
            $activity->notify($locked->id, 'moderation:'.$audit, 'account_moderation', 'Your account is now '.$after.'.', '/profile');

            return ['id' => $locked->id, 'status' => $after, 'moderation_revision' => (int) $locked->moderation_revision, 'hidden_listings' => $hidden];
        });

        return response()->json(['data' => $result]);
    }

    public function audit(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['property_id' => ['nullable', 'integer', 'min:1'], 'user_id' => ['nullable', 'integer', 'min:1'], 'page' => ['nullable', 'integer', 'between:1,100000']]);
        $query = DB::table('moderation_actions');
        foreach (['property_id', 'user_id'] as $filter) {
            if (isset($data[$filter])) {
                $query->where($filter, $data[$filter]);
            }
        }

        return response()->json($query->orderByDesc('id')->paginate(20));
    }
}
