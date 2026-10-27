<?php

namespace App\Http\Resources;

use App\Models\RoomOption;
use App\Services\AvailabilityFreshness;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ViewingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $student = $request->user()->id === $this->student_id;
        $participant = $student ? $this->landlord : $this->student;
        $schedulable = $this->property->status === 'approved' && $this->landlord->status === 'active' && $this->property->roomOptions->contains(fn (RoomOption $option): bool => AvailabilityFreshness::current($option->availability_confirmed_at));

        $published = $schedulable && ! $this->property->owner_paused;

        return ['id' => $this->id, 'property_id' => $this->property_id, 'room_option_id' => $this->room_option_id, 'listing_snapshot' => $this->listing_snapshot, 'starts_at' => $this->starts_at->toIso8601String(), 'requested_start' => $this->requested_start->toIso8601String(), 'time_passed' => $this->starts_at->isPast(), 'status' => $this->status, 'revision' => $this->revision, 'student_note' => $this->student_note, 'owner_note' => $this->owner_note, 'participant_name' => $participant->name, 'participant_avatar_url' => $participant->avatarUrl(), 'conversation_id' => $this->conversation_id, 'property_preview' => $published && $this->property->relationLoaded('photos') ? ['title' => $this->property->title, 'is_demo' => $this->property->is_demo, 'photos' => PhotoResource::collection($this->property->photos->where('status', 'ready')->take(1))] : null, 'can_schedule' => $schedulable && $this->student->status === 'active' && $this->property->roomOptions->contains(fn (RoomOption $option): bool => $option->id === $this->room_option_id && $option->available_units > 0 && AvailabilityFreshness::current($option->availability_confirmed_at))];
    }
}
