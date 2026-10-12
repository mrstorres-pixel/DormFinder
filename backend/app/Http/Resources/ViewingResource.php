<?php

namespace App\Http\Resources;

use App\Models\RoomOption;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ViewingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $student = $request->user()->id === $this->student_id;

        return ['id' => $this->id, 'property_id' => $this->property_id, 'room_option_id' => $this->room_option_id, 'listing_snapshot' => $this->listing_snapshot, 'starts_at' => $this->starts_at->toIso8601String(), 'requested_start' => $this->requested_start->toIso8601String(), 'time_passed' => $this->starts_at->isPast(), 'status' => $this->status, 'revision' => $this->revision, 'student_note' => $this->student_note, 'owner_note' => $this->owner_note, 'participant_name' => $student ? $this->landlord->name : $this->student->name, 'can_schedule' => $this->property->status === 'approved' && $this->student->status === 'active' && $this->landlord->status === 'active' && $this->property->roomOptions->contains(fn (RoomOption $option): bool => $option->id === $this->room_option_id && $option->available_units > 0)];
    }
}
