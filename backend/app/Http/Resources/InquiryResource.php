<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InquiryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $participant = $request->user()->id === $this->student_id ? $this->landlord : $this->student;

        return [
            'id' => $this->id, 'property_id' => $this->property_id,
            'listing_snapshot' => $this->listing_snapshot,
            'property_status' => $this->property->status,
            'participant_name' => $participant->name,
            'participant_role' => $participant->role,
            'participant_avatar_url' => $participant->avatarUrl(),
            'last_message_body' => $this->last_message_body,
            'last_message_is_own' => isset($this->last_sender_id) && (int) $this->last_sender_id === $request->user()->id,
            'can_reply' => $this->canReply(), 'awaiting_reply' => isset($this->last_sender_id) && (int) $this->last_sender_id !== $request->user()->id && $this->canReply(), 'last_message_at' => $this->last_message_at,
        ];
    }
}
