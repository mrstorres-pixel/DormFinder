<?php

namespace App\Services;

use App\Models\Property;
use Illuminate\Validation\ValidationException;

class ListingWorkflow
{
    public function assertComplete(Property $property): void
    {
        $errors = [];
        if (mb_strlen(trim((string) $property->description)) < 40) {
            $errors['description'] = 'Describe your property in at least 40 characters.';
        }
        if (! filled($property->address)) {
            $errors['address'] = 'Add the street address before submission.';
        }
        if ($property->latitude === null || $property->longitude === null) {
            $errors['coordinates'] = 'Add both latitude and longitude before submission.';
        }
        if (! $property->photos()->where('status', 'ready')->exists()) {
            $errors['photos'] = 'Add at least one ready property photo.';
        }
        if ($property->photos()->whereIn('status', ['uploading', 'pending_deletion'])->exists()) {
            $errors['photos'] = 'Wait for photo uploads or cleanup to finish before submission.';
        }
        if (! $property->roomOptions()->exists()) {
            $errors['room_options'] = 'Add at least one room option with understandable charges.';
        }
        if ($property->roomOptions()->where('availability_confirmed_at', '<', now()->subDays(14))->exists()) {
            $errors['availability'] = 'Confirm current room availability before submission.';
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function demote(Property $property): void
    {
        $property->status = 'draft';
        $property->approved_at = null;
        $property->submitted_at = null;
        $property->moderation_reason = null;
        $property->revision++;
        $property->save();
    }
}
