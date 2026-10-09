<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InquiryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'property_id' => $this->property_id,
            'listing_snapshot' => $this->listing_snapshot,
            'property_status' => $this->property->status,
            'participant_name' => $request->user()->id === $this->student_id ? $this->landlord->name : $this->student->name,
            'can_reply' => $this->canReply(), 'last_message_at' => $this->last_message_at,
        ];
    }
}
