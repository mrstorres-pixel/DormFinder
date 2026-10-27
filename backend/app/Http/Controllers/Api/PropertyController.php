<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PropertyRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Services\AdminBrowse;
use App\Services\AvailabilityFreshness;
use App\Services\ListingWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class PropertyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Property::class);
        app(AvailabilityFreshness::class)->remind($request->user());
        $data = AdminBrowse::filters($request, [
            'view' => ['nullable', Rule::in(['active', 'attention', 'archived', 'all'])],
            'owner_state' => ['nullable', Rule::in(['draft', 'pending_review', 'live', 'taken', 'paused', 'rejected', 'suspended', 'expired'])],
            'status' => ['nullable', Rule::in(['draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived'])],
            'availability' => ['nullable', Rule::in(['needs_confirmation', 'taken'])],
            'sort' => ['nullable', Rule::in(['newest', 'oldest', 'updated', 'title_asc', 'title_desc'])],
        ]);
        $query = $request->user()->properties()->with(ListingController::relations());
        if (in_array($data['view'] ?? 'all', ['active', 'attention'], true)) {
            $query->where('status', '!=', 'archived');
        } elseif (($data['view'] ?? 'all') === 'archived') {
            $query->where('status', 'archived');
        }
        if (($data['view'] ?? null) === 'attention') {
            $query->where(function (Builder $attention): void {
                $attention->whereIn('status', ['draft', 'rejected'])->orWhere(function (Builder $due): void {
                    $due->where('status', 'approved')->where('owner_paused', false)->whereHas('roomOptions', fn (Builder $options) => $options->where('available_units', '>', 0))
                        ->whereHas('roomOptions', fn (Builder $options) => $options->where('availability_confirmed_at', '<=', now()->subDays(AvailabilityFreshness::REMIND_DAYS)));
                });
            });
        }
        $ownerState = $data['owner_state'] ?? null;
        if (in_array($ownerState, ['draft', 'pending_review', 'rejected', 'suspended'], true)) {
            $query->where('status', $ownerState);
        } elseif ($ownerState === 'paused') {
            $query->where('status', 'approved')->where('owner_paused', true);
        } elseif (in_array($ownerState, ['live', 'taken', 'expired'], true)) {
            $query->where('status', 'approved')->where('owner_paused', false)->has('roomOptions');
            if ($ownerState === 'taken') {
                $query->whereDoesntHave('roomOptions', fn (Builder $options) => $options->where('available_units', '>', 0));
            } elseif ($ownerState === 'live') {
                $query->whereHas('roomOptions', fn (Builder $options) => $options->where('available_units', '>', 0)->where('availability_confirmed_at', '>', now()->subDays(AvailabilityFreshness::HIDE_DAYS)));
            } else {
                $query->whereHas('roomOptions', fn (Builder $options) => $options->where('available_units', '>', 0))->whereDoesntHave('roomOptions', fn (Builder $options) => $options->where('availability_confirmed_at', '>', now()->subDays(AvailabilityFreshness::HIDE_DAYS)));
            }
        }

        if (filled($data['q'] ?? null)) {
            $pattern = AdminBrowse::pattern($data['q']);
            $query->where(function (Builder $query) use ($pattern): void {
                $query->whereRaw('lower(title) LIKE ?', [$pattern])
                    ->orWhereRaw('lower(coalesce(address, ?)) LIKE ?', ['', $pattern])
                    ->orWhereRaw('lower(city) LIKE ?', [$pattern]);
            });
        }
        if (filled($data['status'] ?? null)) {
            $query->where('status', $data['status']);
        }
        if (($data['availability'] ?? null) === 'needs_confirmation') {
            $query->where('status', 'approved')->where('owner_paused', false)->whereHas('roomOptions', fn (Builder $options) => $options->where('available_units', '>', 0))->whereHas('roomOptions', function (Builder $query): void {
                $query->where('availability_confirmed_at', '<=', now()->subDays(AvailabilityFreshness::REMIND_DAYS));
            });
        } elseif (($data['availability'] ?? null) === 'taken') {
            $query->where('status', 'approved')->has('roomOptions')->whereDoesntHave('roomOptions', fn (Builder $query) => $query->where('available_units', '>', 0));
        }
        $sort = $data['sort'] ?? 'newest';
        if (str_starts_with($sort, 'title_')) {
            $query->orderBy('title', $sort === 'title_asc' ? 'asc' : 'desc');
        } elseif ($sort === 'updated') {
            $query->orderByDesc('updated_at');
        }

        return PropertyResource::collection(
            $query->orderBy('id', $sort === 'oldest' ? 'asc' : 'desc')->paginate($data['per_page'] ?? 12)->withQueryString()
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
