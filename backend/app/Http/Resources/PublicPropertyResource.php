<?php

namespace App\Http\Resources;

use App\Services\AvailabilityFreshness;
use App\Services\PropertyLocation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicPropertyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'title' => $this->title, 'description' => $this->description,
            'property_type' => $this->property_type, 'address' => $this->address, 'city' => $this->city,
            'latitude' => PropertyLocation::usable($this->latitude, $this->longitude) ? $this->latitude : null, 'longitude' => PropertyLocation::usable($this->latitude, $this->longitude) ? $this->longitude : null, 'is_demo' => $this->is_demo,
            'location_check' => PropertyLocation::summary($this->latitude, $this->longitude),
            'approved_at' => $this->approved_at, 'amenities' => $this->amenities, 'house_rules' => $this->house_rules,
            'distance_from_campus' => $this->when(isset($this->distance_campus_id), fn () => ['campus_id' => (int) $this->distance_campus_id, 'meters' => ! PropertyLocation::usable($this->latitude, $this->longitude) ? null : (int) round($this->distance_meters), 'method' => 'approximate_straight_line']),
            'photos' => PhotoResource::collection($this->whenLoaded('photos')),
            'room_options' => RoomOptionResource::collection($this->whenLoaded('roomOptions', fn () => $this->roomOptions->filter(fn ($option) => AvailabilityFreshness::current($option->availability_confirmed_at))->values())),
            'alternative_room_options' => RoomOptionResource::collection($this->whenLoaded('comparisonOptions')),
        ];
    }
}
