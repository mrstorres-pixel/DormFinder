<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PropertyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'title' => $this->title, 'description' => $this->description,
            'property_type' => $this->property_type, 'address' => $this->address, 'city' => $this->city,
            'latitude' => $this->latitude, 'longitude' => $this->longitude,
            'status' => $this->status, 'revision' => $this->revision,
            'moderation_reason' => $this->moderation_reason, 'is_demo' => $this->is_demo,
            'photos' => PhotoResource::collection($this->whenLoaded('photos')),
            'created_at' => $this->created_at, 'updated_at' => $this->updated_at,
        ];
    }
}
