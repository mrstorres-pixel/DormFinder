<?php

namespace App\Http\Resources;

use App\Services\PhotoStorage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PhotoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'caption' => $this->caption, 'status' => $this->status,
            'url' => $this->status === 'ready' ? app(PhotoStorage::class)->url($this->resource) : null,
            'expires_at' => now()->addMinutes(config('dormfinder.signed_url_minutes'))->toIso8601String(),
        ];
    }
}
