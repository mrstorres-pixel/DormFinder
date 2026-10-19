<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ViewingResource;
use App\Models\Property;
use App\Models\User;
use App\Models\ViewingRequest;
use App\Services\ActivityRecorder;
use App\Services\AvailabilityFreshness;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ViewingController extends Controller
{
    private const ACTIVE = ['requested', 'proposed', 'accepted'];

    private function participant(Request $request, ViewingRequest $viewing): void
    {
        abort_unless(($request->user()->role === 'student' && $viewing->student_id === $request->user()->id) || ($request->user()->role === 'landlord' && $viewing->landlord_id === $request->user()->id), 404);
    }

    private function time(string $value): CarbonImmutable
    {
        $time = CarbonImmutable::parse($value)->utc();
        if ($time->lt(now()->addMinutes(30)) || $time->gt(now()->addDays(90))) {
            throw ValidationException::withMessages(['starts_at' => 'Choose a time at least 30 minutes ahead and within 90 days.']);
        }

        return $time;
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless(in_array($request->user()->role, ['student', 'landlord'], true), 403);
        $data = $request->validate(['page' => ['nullable', 'integer', 'min:1', 'max:100000'], 'month' => ['nullable', 'date_format:Y-m'], 'status' => ['nullable', Rule::in([...self::ACTIVE, 'declined', 'cancelled'])], 'group' => ['nullable', Rule::in(['upcoming', 'requests', 'history'])], 'id' => ['nullable', 'integer', 'min:1'], 'property_id' => ['nullable', 'integer', 'min:1'], 'active' => ['nullable', 'boolean']]);
        $column = $request->user()->role === 'student' ? 'student_id' : 'landlord_id';
        $query = ViewingRequest::query()->where($column, $request->user()->id)->select('viewing_requests.*')->selectSub(DB::table('inquiries')->select('id')->whereColumn('property_id', 'viewing_requests.property_id')->whereColumn('student_id', 'viewing_requests.student_id')->whereColumn('landlord_id', 'viewing_requests.landlord_id')->limit(1), 'conversation_id')->with(['student', 'landlord', 'property.roomOptions', 'property.photos']);
        if (! empty($data['id'])) {
            $query->whereKey($data['id']);
        }
        if (! empty($data['property_id'])) {
            $query->where('property_id', $data['property_id']);
        }
        if (! empty($data['month'])) {
            $start = CarbonImmutable::createFromFormat('!Y-m', $data['month'], 'Asia/Manila');
            $query->where('starts_at', '>=', $start->utc())->where('starts_at', '<', $start->addMonth()->utc());
        }
        if ($request->boolean('active')) {
            $query->whereIn('status', self::ACTIVE)->where(function ($active): void {
                $active->whereIn('status', ['requested', 'proposed'])->orWhere('starts_at', '>', now());
            });
        }
        if (($data['group'] ?? null) === 'upcoming') {
            $query->where('status', 'accepted')->where('starts_at', '>', now())->orderBy('starts_at');
        } elseif (($data['group'] ?? null) === 'requests') {
            $query->whereIn('status', ['requested', 'proposed'])->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [$request->user()->role === 'student' ? 'proposed' : 'requested']);
        } elseif (($data['group'] ?? null) === 'history') {
            $query->where(function ($history): void {
                $history->whereIn('status', ['cancelled', 'declined'])->orWhere(function ($past): void {
                    $past->where('status', 'accepted')->where('starts_at', '<=', now());
                });
            })->orderByDesc('starts_at');
        }
        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        return ViewingResource::collection($query->orderByDesc('id')->paginate(12));
    }

    public function store(Request $request, Property $property): JsonResponse
    {
        abort_unless($request->user()->role === 'student', 403);
        $data = $request->validate(['room_option_id' => ['required', 'integer', 'min:1'], 'client_id' => ['required', 'uuid'], 'starts_at' => ['required', 'date'], 'note' => ['nullable', 'string', 'max:1000']]);
        $requested = CarbonImmutable::parse($data['starts_at'])->utc();
        $note = trim($data['note'] ?? '');
        $viewing = DB::transaction(function () use ($request, $property, $data, $requested, $note): ViewingRequest {
            User::query()->whereIn('id', [$request->user()->id, $property->landlord_id])->orderBy('id')->lockForUpdate()->get();
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            $existing = ViewingRequest::query()->where('student_id', $request->user()->id)->where('client_id', $data['client_id'])->first();
            if ($existing) {
                abort_unless($existing->property_id === $property->id && $existing->room_option_id === (int) $data['room_option_id'] && $existing->requested_start->equalTo($requested) && $existing->student_note === $note, 409);

                return $existing;
            }
            $time = $this->time($data['starts_at']);
            abort_unless($locked->status === 'approved' && $locked->landlord->status === 'active', 404);
            $option = $locked->roomOptions()->findOrFail($data['room_option_id']);
            abort_unless(AvailabilityFreshness::current($option->availability_confirmed_at), 404);
            abort_unless($option->available_units > 0, 409, 'This room option is sold out.');
            abort_if(ViewingRequest::query()->where('student_id', $request->user()->id)->where('property_id', $property->id)->whereIn('status', self::ACTIVE)->where(function ($query): void {
                $query->where('starts_at', '>', now())->orWhereIn('status', ['requested', 'proposed']);
            })->exists(), 409, 'You already have an active viewing for this listing.');
            $viewing = ViewingRequest::query()->create(['property_id' => $property->id, 'room_option_id' => $option->id, 'student_id' => $request->user()->id, 'landlord_id' => $locked->landlord_id, 'client_id' => $data['client_id'], 'requested_start' => $time, 'starts_at' => $time, 'status' => 'requested', 'revision' => 1, 'owner_note' => '', 'student_note' => $note, 'listing_snapshot' => ['title' => $locked->title, 'address' => $locked->address, 'city' => $locked->city, 'room_name' => $option->name]]);
            app(ActivityRecorder::class)->notify($locked->landlord_id, 'viewing:'.$viewing->id.':1', 'viewing', 'You have a new viewing request.', '/viewings');

            return $viewing;
        }, 3);

        return (new ViewingResource($viewing->load(['student', 'landlord', 'property.roomOptions'])))->response()->setStatusCode(201);
    }

    public function update(Request $request, ViewingRequest $viewing): ViewingResource
    {
        $this->participant($request, $viewing);
        $data = $request->validate(['action' => ['required', Rule::in(['accept', 'propose', 'decline', 'cancel'])], 'revision' => ['required', 'integer', 'min:1'], 'starts_at' => ['required_if:action,propose', 'nullable', 'date'], 'note' => ['nullable', 'string', 'max:1000']]);
        $updated = DB::transaction(function () use ($request, $viewing, $data): ViewingRequest {
            User::query()->whereIn('id', [$viewing->student_id, $viewing->landlord_id])->orderBy('id')->lockForUpdate()->get();
            $property = Property::query()->lockForUpdate()->findOrFail($viewing->property_id);
            $locked = ViewingRequest::query()->lockForUpdate()->findOrFail($viewing->id);
            abort_unless($locked->revision === (int) $data['revision'], 409, 'This viewing changed. Reload before deciding.');
            abort_unless(in_array($locked->status, self::ACTIVE, true), 409);
            $student = $request->user()->role === 'student';
            $action = $data['action'];
            if ($action === 'cancel') {
                $locked->status = 'cancelled';
            } elseif ($action === 'decline') {
                abort_unless(! $student && in_array($locked->status, ['requested', 'proposed'], true), 403);
                $locked->status = 'declined';
            } else {
                abort_unless($property->status === 'approved' && $locked->student->status === 'active' && $locked->landlord->status === 'active', 409, 'Scheduling is paused because the listing or a participant is unavailable.');
                abort_unless($locked->room_option_id && $property->roomOptions()->whereKey($locked->room_option_id)->where('available_units', '>', 0)->where('availability_confirmed_at', '>', now()->subDays(AvailabilityFreshness::HIDE_DAYS))->exists(), 409, 'This room option is unavailable.');
                if ($action === 'propose') {
                    abort_unless(! $student && in_array($locked->status, ['requested', 'proposed'], true), 403);
                    $locked->starts_at = $this->time($data['starts_at']);
                    $locked->status = 'proposed';
                } else {
                    abort_unless(($student && $locked->status === 'proposed') || (! $student && $locked->status === 'requested'), 403);
                    abort_unless($locked->starts_at->isFuture(), 409, 'This time has passed. Suggest a new time.');
                    $conflict = ViewingRequest::query()->where('status', 'accepted')->where('id', '!=', $locked->id)->where('starts_at', '>', $locked->starts_at->subHour())->where('starts_at', '<', $locked->starts_at->addHour())->where(function ($query) use ($locked): void {
                        $query->where('student_id', $locked->student_id)->orWhere('landlord_id', $locked->landlord_id);
                    })->exists();
                    abort_if($conflict, 409, 'An accepted viewing overlaps this one-hour slot. Choose another time.');
                    $locked->status = 'accepted';
                }
            }
            if (! $student && array_key_exists('note', $data)) {
                $locked->owner_note = trim($data['note'] ?? '');
            }
            $locked->revision++;
            $locked->save();
            $recipient = $student ? $locked->landlord_id : $locked->student_id;
            app(ActivityRecorder::class)->notify($recipient, 'viewing:'.$locked->id.':'.$locked->revision, 'viewing', 'Your viewing request has an update.', '/viewings');

            return $locked;
        }, 3);

        return new ViewingResource($updated->load(['student', 'landlord', 'property.roomOptions']));
    }
}
