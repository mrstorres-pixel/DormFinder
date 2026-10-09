<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\InquiryMessageResource;
use App\Http\Resources\InquiryResource;
use App\Http\Resources\RoomOptionResource;
use App\Models\Inquiry;
use App\Models\InquiryMessage;
use App\Models\Property;
use App\Services\ActivityRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class InquiryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless(in_array($request->user()->role, ['student', 'landlord'], true), 403);
        $column = $request->user()->role === 'student' ? 'student_id' : 'landlord_id';

        return InquiryResource::collection(Inquiry::query()->where($column, $request->user()->id)->with(['property', 'student', 'landlord'])->latest('last_message_at')->paginate(12));
    }

    private function authorizeParticipant(Request $request, Inquiry $inquiry): void
    {
        abort_unless(($request->user()->role === 'student' && $inquiry->student_id === $request->user()->id)
            || ($request->user()->role === 'landlord' && $inquiry->landlord_id === $request->user()->id), 404);
    }

    public function show(Request $request, Inquiry $inquiry): InquiryResource
    {
        $this->authorizeParticipant($request, $inquiry);

        return new InquiryResource($inquiry->load(['property', 'student', 'landlord']));
    }

    public function messages(Request $request, Inquiry $inquiry): AnonymousResourceCollection
    {
        $this->authorizeParticipant($request, $inquiry);

        return InquiryMessageResource::collection($inquiry->messages()->with('sender')->paginate(30));
    }

    public function store(Request $request, Property $property): JsonResponse
    {
        abort_unless($request->user()->role === 'student', 403);
        $data = $request->validate(['room_option_id' => ['required', 'integer', 'min:1'], 'body' => ['required', 'string', 'max:3000'], 'client_id' => ['required', 'uuid']]);
        $inquiry = DB::transaction(function () use ($request, $property, $data): Inquiry {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            $thread = $locked->inquiries()->where('student_id', $request->user()->id)->first();
            if ($thread) {
                $existing = $thread->messages()->where('sender_id', $request->user()->id)->where('client_id', $data['client_id'])->first();
                if ($existing) {
                    abort_unless($existing->body === trim($data['body']), 409);

                    return $thread;
                }
            }
            abort_unless($locked->status === 'approved' && $locked->landlord->status === 'active', 404);
            $option = $locked->roomOptions()->with('fees')->findOrFail($data['room_option_id']);
            if (! $thread) {
                $thread = $locked->inquiries()->create([
                    'student_id' => $request->user()->id, 'landlord_id' => $locked->landlord_id,
                    'room_option_id' => $option->id, 'last_message_at' => now(),
                    'listing_snapshot' => ['title' => $locked->title, 'address' => $locked->address, 'city' => $locked->city, 'room_option' => (new RoomOptionResource($option))->resolve($request)],
                ]);
            }
            $message = $thread->messages()->create(['sender_id' => $request->user()->id, 'client_id' => $data['client_id'], 'body' => trim($data['body'])]);
            app(ActivityRecorder::class)->notify($thread->landlord_id, 'message:'.$message->id, 'inquiry_message', 'You have a new private inquiry message.', '/inquiries/'.$thread->id);
            $thread->last_message_at = now();
            $thread->save();

            return $thread;
        });

        return (new InquiryResource($inquiry->load(['property', 'student', 'landlord'])))->response()->setStatusCode(201);
    }

    public function reply(Request $request, Inquiry $inquiry): JsonResponse
    {
        $this->authorizeParticipant($request, $inquiry);
        $data = $request->validate(['body' => ['required', 'string', 'max:3000'], 'client_id' => ['required', 'uuid']]);
        $message = DB::transaction(function () use ($request, $inquiry, $data): InquiryMessage {
            $property = Property::query()->lockForUpdate()->findOrFail($inquiry->property_id);
            $thread = Inquiry::query()->lockForUpdate()->findOrFail($inquiry->id);
            $existing = $thread->messages()->where('sender_id', $request->user()->id)->where('client_id', $data['client_id'])->first();
            if ($existing) {
                abort_unless($existing->body === trim($data['body']), 409);

                return $existing;
            }
            $thread->setRelation('property', $property);
            abort_unless($thread->canReply(), 409);
            $message = $thread->messages()->create(['sender_id' => $request->user()->id, 'client_id' => $data['client_id'], 'body' => trim($data['body'])]);
            $recipient = $request->user()->id === $thread->student_id ? $thread->landlord_id : $thread->student_id;
            app(ActivityRecorder::class)->notify($recipient, 'message:'.$message->id, 'inquiry_message', 'You have a new private inquiry message.', '/inquiries/'.$thread->id);
            $thread->last_message_at = now();
            $thread->save();

            return $message;
        });

        return (new InquiryMessageResource($message->load('sender')))->response()->setStatusCode(201);
    }
}
