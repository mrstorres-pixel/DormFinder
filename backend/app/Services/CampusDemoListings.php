<?php

namespace App\Services;

use App\Models\ListingReview;
use App\Models\Property;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CampusDemoListings
{
    private const COMPLETE = 'Campus demo v2 complete. Fictional rental; AI-generated image.';

    /** @return list<array<string, mixed>> */
    public function catalog(): array
    {
        $rows = json_decode(file_get_contents(database_path('campus-demo-listings.json')), true, 512, JSON_THROW_ON_ERROR);
        $campuses = json_decode(file_get_contents(database_path('campus-directory.json')), true, 512, JSON_THROW_ON_ERROR);
        $counts = array_count_values(array_column($rows, 'campus_slug'));
        if (count($rows) !== count($campuses) * 3 || array_diff(array_column($campuses, 'slug'), array_keys($counts)) !== []
            || count(array_filter($counts, fn (int $count): bool => $count !== 3)) > 0
            || count(array_unique(array_column($rows, 'key'))) !== count($rows)) {
            throw new \RuntimeException('The catalog must contain exactly three distinct samples per directory campus.');
        }

        return $rows;
    }

    public function imagePath(array $entry): string
    {
        return database_path('demo-images/'.$entry['image']);
    }

    /** @return array{created: int, resumed: int, skipped: int, archived: list<int>, ids: list<int>} */
    public function populate(User $owner, User $reviewer, ?callable $progress = null): array
    {
        if ($owner->email !== DemoListings::OWNER_EMAIL || $owner->name !== DemoListings::OWNER_NAME || $owner->role !== 'landlord' || $owner->status !== 'active'
            || $reviewer->role !== 'admin' || $reviewer->status !== 'active') {
            throw new \RuntimeException('Demo owner or reviewer is invalid; no listing changes made.');
        }
        $catalog = $this->catalog();
        foreach ($catalog as $entry) {
            $size = @getimagesize($this->imagePath($entry));
            if (! $size || $size[2] !== IMAGETYPE_WEBP) {
                throw new \RuntimeException('Every catalog image must be available before staging samples.');
            }
        }
        $result = ['created' => 0, 'resumed' => 0, 'skipped' => 0, 'archived' => [], 'ids' => []];
        DB::select('select pg_advisory_lock(hashtextextended(?, 0))', ['dormfinder-demo-v1']);
        try {
            Auth::guard('web')->setUser($owner);
            $staged = [];
            foreach ($catalog as $index => $entry) {
                $marker = '[Campus demo v2/'.$entry['key'].']';
                $uploadId = sprintf('d0f20000-0000-5000-8000-%012d', $index + 1);
                $attributes = [
                    'title' => $entry['title'], 'property_type' => $entry['kind'] === 'studio' ? 'apartment' : 'dormitory',
                    'address' => 'Demo pin near '.$entry['street'].' (fictional rental)', 'city' => $entry['city'],
                    'latitude' => $entry['latitude'], 'longitude' => $entry['longitude'],
                    'description' => 'FICTIONAL DEMO LISTING — not a real rental offer. A sample '.$entry['capacity'].'-person student rooms for '.$entry['campus_name'].'. The room options represent separate, nonoverlapping inventory. The pin follows a real nearby street, not a verified property or entrance. Interior images are AI-generated examples shared across the demo catalog, not photographs of an actual rental. Prices, charges and availability are illustrative. '.$marker,
                    'amenities' => ['wifi', 'study_area'],
                ];
                $matches = $owner->properties()->where(function ($query) use ($marker, $uploadId): void {
                    $query->where('description', 'like', '%'.$marker.'%')->orWhereHas('photos', fn ($photos) => $photos->where('upload_id', $uploadId));
                })->get();
                if ($matches->count() > 1) {
                    throw new \RuntimeException('Duplicate catalog identity; all existing listings preserved.');
                }
                $property = $matches->first();
                if ($property && ! $property->is_demo) {
                    throw new \RuntimeException('A non-demo listing uses the catalog identity; it was preserved.');
                }
                if ($property && ($property->moderation_reason === self::COMPLETE || $property->status !== 'draft')) {
                    $result['skipped']++;
                    $result['ids'][] = $property->id;

                    continue;
                }
                if ($property) {
                    foreach ($attributes as $field => $value) {
                        if ($value !== $property->$field) {
                            throw new \RuntimeException('An incomplete catalog listing was edited; it was preserved.');
                        }
                    }
                    if ($property->roomOptions()->count() !== 2 || $property->photos()->where('upload_id', '!=', $uploadId)->exists()
                        || $property->photos()->where('status', '!=', 'ready')->exists() || $property->revision > 2) {
                        throw new \RuntimeException('An incomplete catalog listing has unexpected related data; it was preserved.');
                    }
                    foreach ($property->roomOptions()->get() as $optionIndex => $room) {
                        foreach ($this->room($entry, $optionIndex) as $field => $value) {
                            if ($value !== $room->$field) {
                                throw new \RuntimeException('An incomplete catalog room was edited; it was preserved.');
                            }
                        }
                        if ($room->fees()->count() !== 0) {
                            throw new \RuntimeException('An incomplete catalog room has edited fees; it was preserved.');
                        }
                    }
                    $result['resumed']++;
                } else {
                    $property = DB::transaction(function () use ($owner, $attributes, $entry): Property {
                        $property = new Property($attributes);
                        $property->landlord_id = $owner->id;
                        $property->is_demo = true;
                        $property->status = 'draft';
                        $property->revision = 1;
                        $property->save();
                        foreach ([0, 1] as $optionIndex) {
                            $property->roomOptions()->create($this->room($entry, $optionIndex) + [
                                'availability_confirmed_at' => now(),
                                'utilities_notes' => 'Illustrative terms: water and internet included; metered electricity additional. Confirm actual terms with the owner.',
                            ]);

                        }

                        return $property;
                    });
                    $result['created']++;
                }
                $result['ids'][] = $property->id;
                if (! $property->photos()->where('upload_id', $uploadId)->where('status', 'ready')->exists()) {
                    app(PhotoStorage::class)->upload($property->fresh(), new UploadedFile($this->imagePath($entry), $entry['image'], 'image/webp', null, true), [
                        'upload_id' => $uploadId, 'revision' => $property->fresh()->revision,
                        'caption' => 'AI-generated demo interior — illustrative '.$entry['capacity'].'-person room, not an actual property photo',
                    ]);
                }
                $staged[$property->id] = $property->fresh()->revision;
                if ($progress !== null) {
                    $progress('Staged sample '.$property->id.' for '.$entry['campus_slug']);
                }
            }
            DB::transaction(function () use ($staged, $owner, $reviewer, &$result): void {
                foreach ($staged as $id => $revision) {
                    $property = Property::query()->lockForUpdate()->findOrFail($id);
                    if ($property->status !== 'draft' || $property->revision !== $revision) {
                        throw new \RuntimeException('A staged sample changed; publication and retirement cancelled.');
                    }
                    app(ListingWorkflow::class)->assertComplete($property);
                    $property->status = 'approved';
                    $property->submitted_at = now();
                    $property->approved_at = now();
                    $property->moderation_reason = self::COMPLETE;
                    $property->revision++;
                    $property->save();
                    ListingReview::query()->create(['property_id' => $id, 'administrator_id' => $reviewer->id, 'revision' => $revision, 'decision' => 'approved', 'reason' => self::COMPLETE]);
                    app(ActivityRecorder::class)->audit($reviewer->id, 'listing_review', 'draft', 'approved', $property->revision, self::COMPLETE, $id);
                }
                $old = $owner->properties()->where('is_demo', true)->where('description', 'like', '%[Sample set dormfinder-v1/%')->where('status', '!=', 'archived')->orderBy('id')->lockForUpdate()->get();
                foreach ($old as $property) {
                    $before = $property->status;
                    $property->status = 'archived';
                    $property->approved_at = null;
                    $property->moderation_reason = 'Replaced by the campus demo catalog. Private messages, saved places and viewing history retained.';
                    $property->revision++;
                    $property->save();
                    app(ActivityRecorder::class)->audit($reviewer->id, 'listing_status', $before, 'archived', $property->revision, $property->moderation_reason, $property->id);
                    $result['archived'][] = $property->id;
                }
            });
        } finally {
            Auth::forgetGuards();
            DB::select('select pg_advisory_unlock(hashtextextended(?, 0))', ['dormfinder-demo-v1']);
        }

        return $result;
    }

    /** @return array<string, int|string> */
    private function room(array $entry, int $optionIndex): array
    {
        $rent = $entry['monthly_rent_centavos'] + $optionIndex * ($entry['kind'] === 'studio' ? 50000 : 25000);

        return [
            'name' => ($optionIndex === 1 ? 'Upper-floor: ' : '').['studio' => 'Private student studio', 'twin' => 'Twin student beds', 'quad' => 'Four-person shared beds'][$entry['kind']],
            'inventory_type' => $entry['kind'] === 'studio' ? 'whole_room' : 'bedspace',
            'price_basis' => $entry['kind'] === 'studio' ? 'per_room' : 'per_person', 'capacity' => $entry['capacity'],
            'total_units' => $entry['capacity'], 'available_units' => $entry['kind'] === 'quad' ? 3 : 1,
            'monthly_rent_centavos' => $rent, 'deposit_centavos' => $rent, 'advance_months' => 1,
        ];
    }
}
