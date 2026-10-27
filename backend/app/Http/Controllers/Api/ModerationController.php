<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Models\User;
use App\Services\ActivityRecorder;
use App\Services\AdminBrowse;
use Carbon\CarbonImmutable;
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
        $data = AdminBrowse::filters($request, ['status' => ['nullable', Rule::in(['draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived'])], 'property_type' => ['nullable', Rule::in(['dormitory', 'apartment', 'boarding_house', 'rental_room'])], 'sort' => ['nullable', Rule::in(['newest', 'oldest', 'title_asc', 'title_desc'])]]);
        $query = Property::query()->with([...ListingController::relations(), 'landlord:id,name']);
        AdminBrowse::propertySearch($query, $data['q'] ?? null);
        if (filled($data['status'] ?? null)) {
            $query->where('status', $data['status']);
        }

        if (filled($data['property_type'] ?? null)) {
            $query->where('property_type', $data['property_type']);
        }
        $sort = $data['sort'] ?? 'newest';
        if (str_starts_with($sort, 'title_')) {
            $query->orderBy('title', $sort === 'title_asc' ? 'asc' : 'desc');
        }

        return PropertyResource::collection($query->orderBy('id', $sort === 'oldest' ? 'asc' : 'desc')->paginate($data['per_page'] ?? 12)->withQueryString());
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
            if ($owner) {
                $locked->owner_paused = false;
            }
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
        $data = AdminBrowse::filters($request, ['id' => ['nullable', 'integer', 'min:1'], 'status' => ['nullable', Rule::in(['active', 'suspended'])], 'role' => ['nullable', Rule::in(['student', 'landlord'])], 'sort' => ['nullable', Rule::in(['newest', 'oldest', 'name_asc', 'name_desc'])]]);
        $query = User::query()->select(['id', 'name', 'email', 'role', 'status', 'moderation_revision', 'created_at'])->whereIn('role', ['student', 'landlord']);
        if (isset($data['id'])) {
            $query->where('id', $data['id']);
        }
        if (filled($data['q'] ?? null)) {
            $pattern = AdminBrowse::pattern($data['q']);
            $query->where(function ($query) use ($pattern): void {
                $query->whereRaw('lower(name) LIKE ?', [$pattern])->orWhereRaw('lower(email) LIKE ?', [$pattern]);
            });
        }
        if (filled($data['status'] ?? null)) {
            $query->where('status', $data['status']);
        }

        if (filled($data['role'] ?? null)) {
            $query->where('role', $data['role']);
        }
        $sort = $data['sort'] ?? 'oldest';
        if (str_starts_with($sort, 'name_')) {
            $query->orderBy('name', $sort === 'name_asc' ? 'asc' : 'desc');
        }

        return response()->json($query->orderBy('id', $sort === 'newest' ? 'desc' : 'asc')->paginate($data['per_page'] ?? 12)->withQueryString());
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
        $data = AdminBrowse::filters($request, ['property_id' => ['nullable', 'integer', 'min:1'], 'user_id' => ['nullable', 'integer', 'min:1'], 'action' => ['nullable', Rule::in(['listing_review', 'listing_status', 'listing_archive', 'listing_restore', 'listing_suspend', 'account_suspend', 'account_reactivate', 'account_listing_hidden', 'report_closed', 'availability_update'])], 'sort' => ['nullable', Rule::in(['newest', 'oldest'])], 'from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d', ...($request->filled('from') ? ['after_or_equal:from'] : [])]]);
        $query = DB::table('moderation_actions')->leftJoin('users as actor', 'actor.id', '=', 'moderation_actions.actor_id')->leftJoin('users as subject', 'subject.id', '=', 'moderation_actions.user_id')->leftJoin('properties', 'properties.id', '=', 'moderation_actions.property_id')->select(['moderation_actions.*', 'actor.name as actor_name', 'subject.name as account_name', 'properties.title as listing_title']);
        foreach (['property_id', 'user_id'] as $filter) {
            if (isset($data[$filter])) {
                $query->where('moderation_actions.'.$filter, $data[$filter]);
            }
        }

        if (filled($data['q'] ?? null)) {
            $pattern = AdminBrowse::pattern($data['q']);
            $query->where(fn ($query) => $query->whereRaw('lower(reason) LIKE ?', [$pattern])->orWhereRaw('lower(action) LIKE ?', [$pattern])->orWhereRaw('lower(actor.name) LIKE ?', [$pattern])->orWhereRaw('lower(subject.name) LIKE ?', [$pattern])->orWhereRaw('lower(properties.title) LIKE ?', [$pattern]));
        }
        if (filled($data['action'] ?? null)) {
            $query->where('action', $data['action']);
        }
        foreach (['from' => '>=', 'to' => '<='] as $field => $operator) {
            if (filled($data[$field] ?? null)) {
                $date = CarbonImmutable::parse($data[$field], 'Asia/Manila');
                $query->where('moderation_actions.created_at', $operator, ($field === 'from' ? $date->startOfDay() : $date->endOfDay())->utc());
            }
        }

        return response()->json($query->orderBy('moderation_actions.id', ($data['sort'] ?? 'newest') === 'oldest' ? 'asc' : 'desc')->paginate($data['per_page'] ?? 20)->withQueryString());
    }
}
