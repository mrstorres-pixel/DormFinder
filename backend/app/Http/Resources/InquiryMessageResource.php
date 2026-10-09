<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InquiryMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'sender_id' => $this->sender_id, 'sender_name' => $this->sender->name, 'body' => $this->body, 'created_at' => $this->created_at];
    }
}
