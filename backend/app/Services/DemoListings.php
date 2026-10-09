<?php

namespace App\Services;

use App\Models\ListingReview;
use App\Models\Property;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DemoListings
{
    public const OWNER_EMAIL = 'sample-landlord-v1@example.test';

    public const OWNER_NAME = 'DormFinder Sample Owner';

    /** @return list<array<string, mixed>> */
    public function catalog(): array
    {
        $items = [
            ['Sampaguita Student Dorm', 'dormitory', 300000, 850000],
            ['Study Nook Residence', 'dormitory', 350029, 950000],
            ['Quiet Courtyard House', 'boarding_house', 420000, 1100000],
            ['Sunlit Studio Apartment', 'apartment', 850000, 1050000],
            ['Budget Bedspace House', 'boarding_house', 250000, 650000],
            ['Riverside Rental Rooms', 'rental_room', 480000, 920000],
            ['Casal Corner Residence', 'rental_room', 390000, 890000],
            ['Green Terrace Apartments', 'apartment', 1000000, 1400000],
            ['Campus Study Dorm', 'dormitory', 500000, 1200000],
            ['Quiet Study Boarding House', 'boarding_house', 310000, 750000],
            ['Garden Twin Rooms', 'rental_room', 450000, 1050000],
            ['Mixed Availability Dorm', 'dormitory', 200000, 820000],
            ['Fully Booked Boarding House', 'boarding_house', 400000, 980000],
            ['Availability Needs Confirmation', 'dormitory', 340000, 990000],
            ['Premium Study Loft', 'apartment', 1200000, 1600000],
            ['Near Campus Twin Dorm', 'dormitory', 400000, 950000],
            ['Owner Draft Example', 'boarding_house', 320000, 800000],
            ['Pending Review Example', 'dormitory', 380000, 900000],
            ['Returned For Correction Example', 'rental_room', 410000, 1000000],
        ];
        $catalog = [];
        foreach ($items as $index => [$name, $type, $rent, $secondRent]) {
            $status = $index < 16 ? 'approved' : ['draft', 'pending_review', 'rejected'][$index - 16];
            $whole = $type === 'apartment';
            $special = $index === 11;
            $soldOut = $index === 12;
            $options = [
                ['name' => $whole ? 'Independent studio A' : 'Shared student beds', 'inventory_type' => $whole ? 'whole_room' : 'bedspace', 'price_basis' => $whole ? 'per_room' : 'per_person', 'monthly_rent_centavos' => $rent, 'available_units' => $special || $soldOut ? 0 : 2 + $index % 3],
                ['name' => $special ? 'Separate premium beds' : ($whole ? 'Independent studio B' : 'Separate private room'), 'inventory_type' => $special ? 'bedspace' : 'whole_room', 'price_basis' => $special ? 'per_person' : 'per_room', 'monthly_rent_centavos' => $secondRent, 'available_units' => $soldOut ? 0 : 2],
            ];
            $catalog[] = [
                'index' => $index, 'title' => '[DEMO] '.$name, 'name' => $name, 'property_type' => $type,
                'address' => 'Fictional sample address '.($index + 1).', Demo Zone '.chr(65 + $index % 4),
                'city' => 'Manila', 'latitude' => 14.5953363 + (($index % 5) - 2) * 0.0015,
                'longitude' => 120.9881329 + (intdiv($index, 5) - 1) * 0.002,
                'description' => 'FICTIONAL DEMO LISTING — not a real rental offer. These sample rooms, prices, fees, address and map pin exist only to demonstrate DormFinder. The two options represent separate, nonoverlapping inventory. Pictures are illustrative layouts, not photographs of a property. '.($index === 13 ? 'This example intentionally has availability last confirmed 16 days ago. ' : '').($index === 11 ? 'The cheapest beds are sold out; separate premium beds remain available. ' : '').($index === 12 ? 'All example inventory is sold out. ' : '').'[Sample set dormfinder-v1/'.($index + 1).']',
                'target_status' => $status, 'stale' => $index === 13, 'options' => $options,
            ];
        }

        return $catalog;
    }

    /** @return array{created: int, resumed: int, skipped: int, ids: list<int>} */
    public function populate(User $owner, User $reviewer, ?callable $progress = null): array
    {
        if ($owner->email !== self::OWNER_EMAIL || $owner->name !== self::OWNER_NAME || $owner->role !== 'landlord' || $owner->status !== 'active'
            || $reviewer->role !== 'admin' || $reviewer->status !== 'active') {
            throw new \RuntimeException('Demo owner or reviewer is invalid; no listing changes made.');
        }
        $knownTitles = array_column($this->catalog(), 'title');
        $knownUploads = [];
        foreach ($this->catalog() as $entry) {
            $knownUploads[] = $this->uploadId($entry['index'], 0);
            $knownUploads[] = $this->uploadId($entry['index'], 1);
        }
        if ($owner->properties()->whereNotIn('title', $knownTitles)->whereDoesntHave('photos', fn ($query) => $query->whereIn('upload_id', $knownUploads))->exists()) {
            throw new \RuntimeException('An unrecognized listing belongs to the reserved sample owner; all existing listings were preserved.');
        }
        $result = ['created' => 0, 'resumed' => 0, 'skipped' => 0, 'ids' => []];
        DB::select('select pg_advisory_lock(hashtextextended(?, 0))', ['dormfinder-demo-v1']);
        try {
            Auth::guard('web')->setUser($owner);
            foreach ($this->catalog() as $entry) {
                $attributes = array_intersect_key($entry, array_flip(['title', 'description', 'property_type', 'address', 'city', 'latitude', 'longitude']));
                $expectedUploads = [$this->uploadId($entry['index'], 0), $this->uploadId($entry['index'], 1)];
                $matches = $owner->properties()->where(function ($query) use ($entry, $expectedUploads): void {
                    $query->where('title', $entry['title'])->orWhereHas('photos', fn ($photos) => $photos->whereIn('upload_id', $expectedUploads));
                })->get();
                if ($matches->count() > 1) {
                    throw new \RuntimeException('Duplicate demo identity found; existing rows were preserved.');
                }
                $property = $matches->first();
                if ($property) {
                    if (! $property->is_demo) {
                        throw new \RuntimeException('A non-demo listing uses this identity; it was preserved.');
                    }
                    $result['ids'][] = $property->id;
                    if ($property->revision >= 4 || $property->moderation_reason === 'Sample set dormfinder-v1 complete.' || $property->status !== 'draft') {
                        $result['skipped']++;
                        if ($progress !== null) {
                            $progress('Preserved existing sample #'.$property->id);
                        }

                        continue;
                    }
                    foreach ($attributes as $field => $value) {
                        if ((string) $property->$field !== (string) $value) {
                            throw new \RuntimeException('An incomplete sample was edited; it was preserved.');
                        }
                    }
                    if ($property->photos()->whereNotIn('upload_id', $expectedUploads)->exists()
                        || $property->photos()->where('status', '!=', 'ready')->exists()
                        || $property->roomOptions()->count() !== 2 || $property->revision > 3) {
                        throw new \RuntimeException('An incomplete sample has unexpected related data; it was preserved.');
                    }
                    foreach ($property->roomOptions()->with('fees')->get() as $optionIndex => $room) {
                        foreach ($entry['options'][$optionIndex] as $field => $value) {
                            if ((string) $room->$field !== (string) $value) {
                                throw new \RuntimeException('An incomplete sample room was edited; it was preserved.');
                            }
                        }
                        if ($room->fees->count() !== 2 || $room->fees->pluck('amount_centavos')->all() !== [25000, 10000]) {
                            throw new \RuntimeException('An incomplete sample fee was edited; it was preserved.');
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
                        foreach ($entry['options'] as $option) {
                            $room = $property->roomOptions()->create($option + [
                                'capacity' => $option['inventory_type'] === 'bedspace' ? 4 : 2,
                                'total_units' => 8, 'deposit_centavos' => $option['monthly_rent_centavos'],
                                'advance_months' => 1, 'utilities_notes' => 'Demo terms only. Water included; electricity billed by actual meter usage. Confirm terms before any real rental.',
                                'availability_confirmed_at' => now(),
                            ]);
                            $room->fees()->createMany([
                                ['name' => 'Sample internet fee', 'frequency' => 'monthly', 'amount_centavos' => 25000],
                                ['name' => 'Sample key deposit', 'frequency' => 'one_time', 'amount_centavos' => 10000],
                            ]);
                        }

                        return $property;
                    });
                    $result['created']++;
                    $result['ids'][] = $property->id;
                }
                foreach ([0, 1] as $view) {
                    $uploadId = $this->uploadId($entry['index'], $view);
                    if ($property->photos()->where('upload_id', $uploadId)->where('status', 'ready')->exists()) {
                        continue;
                    }
                    $image = app(DemoRoomImage::class)->create($entry['index'], $view, $entry['name']);
                    try {
                        app(PhotoStorage::class)->upload($property->fresh(), $image, ['upload_id' => $uploadId, 'revision' => $property->fresh()->revision, 'caption' => $view === 0 ? 'Synthetic room layout — not an actual property photo' : 'Synthetic study-space layout — not an actual property photo']);
                    } finally {
                        unlink($image->getPathname());
                    }
                }
                DB::transaction(function () use ($property, $reviewer, $entry): void {
                    $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
                    abort_unless($locked->status === 'draft' && $locked->is_demo && $locked->photos()->where('status', 'ready')->count() === 2, 409);
                    if ($entry['target_status'] === 'draft') {
                        $locked->moderation_reason = 'Sample set dormfinder-v1 complete.';
                        $locked->revision = max(4, $locked->revision + 1);
                        $locked->save();

                        return;
                    }
                    app(ListingWorkflow::class)->assertComplete($locked);
                    $locked->status = 'pending_review';
                    $locked->submitted_at = now();
                    $locked->revision++;
                    $locked->save();
                    app(ActivityRecorder::class)->notify($reviewer->id, 'submission:'.$locked->id.':'.$locked->revision, 'listing_submission', 'A demo listing is ready for content review.', '/admin/reviews/'.$locked->id);
                    if ($entry['target_status'] === 'pending_review') {
                        return;
                    }
                    $reason = $entry['target_status'] === 'approved'
                        ? 'Synthetic demo content approved for software demonstration only. This is not a real rental offer.'
                        : 'Demo review feedback: this fictional example illustrates a listing returned for correction.';
                    ListingReview::query()->create(['property_id' => $locked->id, 'administrator_id' => $reviewer->id, 'revision' => $locked->revision, 'decision' => $entry['target_status'], 'reason' => $reason]);
                    $locked->status = $entry['target_status'];
                    $locked->approved_at = $locked->status === 'approved' ? now() : null;
                    $locked->moderation_reason = $reason;
                    $locked->revision++;
                    $locked->save();
                    $activity = app(ActivityRecorder::class);
                    $audit = $activity->audit($reviewer->id, 'listing_review', 'pending_review', $locked->status, $locked->revision, $reason, $locked->id);
                    $activity->notify($locked->landlord_id, 'review:'.$audit, 'listing_review', 'Your demo listing review is complete: '.$locked->status.'.', '/landlord/properties/'.$locked->id);
                    if ($entry['stale']) {
                        $locked->roomOptions()->update(['availability_confirmed_at' => now()->subDays(16)]);
                    }
                });
                if ($progress !== null) {
                    $progress('Created demo #'.$property->id.': '.$entry['title']);
                }
            }
        } finally {
            Auth::forgetGuards();
            DB::select('select pg_advisory_unlock(hashtextextended(?, 0))', ['dormfinder-demo-v1']);
        }

        return $result;
    }

    private function uploadId(int $index, int $view): string
    {
        return sprintf('d0f10000-0000-5000-8000-%012d', ($index + 1) * 10 + $view);
    }
}
