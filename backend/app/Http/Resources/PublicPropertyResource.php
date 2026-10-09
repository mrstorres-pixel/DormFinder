<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicPropertyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'title' => $this->title, 'description' => $this->description,
            'property_type' => $this->property_type, 'address' => $this->address, 'city' => $this->city,
            'latitude' => $this->latitude, 'longitude' => $this->longitude, 'is_demo' => $this->is_demo,
            'approved_at' => $this->approved_at,
            'distance_from_campus' => $this->when(isset($this->distance_campus_id), fn () => ['campus_id' => (int) $this->distance_campus_id, 'meters' => $this->latitude === null || $this->longitude === null ? null : (int) round($this->distance_meters), 'method' => 'approximate_straight_line']),
            'photos' => PhotoResource::collection($this->whenLoaded('photos')),
            'room_options' => RoomOptionResource::collection($this->whenLoaded('roomOptions')),
            'alternative_room_options' => RoomOptionResource::collection($this->whenLoaded('comparisonOptions')),
        ];
    }
}
