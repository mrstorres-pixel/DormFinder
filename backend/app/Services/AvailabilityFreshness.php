<?php

namespace App\Services;

use App\Models\Property;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AvailabilityFreshness
{
    public const REMIND_DAYS = 14;

    public const WARNING_DAYS = 27;

    public const HIDE_DAYS = 30;

    public static function visibleOptions(Builder|Relation $query): void
    {
        $query->where('availability_confirmed_at', '>', now()->subDays(self::HIDE_DAYS));
    }

    public static function current(?CarbonInterface $confirmedAt): bool
    {
        return $confirmedAt !== null && $confirmedAt->gt(now()->subDays(self::HIDE_DAYS));
    }

    public static function summary(Property $property): array
    {
        $options = $property->relationLoaded('roomOptions') ? $property->roomOptions : $property->roomOptions()->get();
        $latest = $options->max('availability_confirmed_at');
        $due = $options->filter(fn ($option): bool => ! $option->availability_confirmed_at || $option->availability_confirmed_at->lte(now()->subDays(self::REMIND_DAYS)))->count();

        return [
            'status' => ! self::current($latest) ? 'hidden' : ($due > 0 ? 'needs_confirmation' : 'current'),
            'last_confirmed_at' => $latest?->toIso8601String(),
            'hides_at' => $latest?->copy()->addDays(self::HIDE_DAYS)->toIso8601String(),
            'rooms_needing_confirmation' => $due,
            'hidden_rooms' => $options->filter(fn ($option): bool => ! self::current($option->availability_confirmed_at))->count(),
        ];
    }

    public function remind(User $owner): void
    {
        if ($owner->role !== 'landlord' || $owner->status !== 'active') {
            return;
        }
        DB::transaction(function () use ($owner): void {
            // Match viewing lock order while allowing notification foreign-key checks.
            User::query()->whereKey($owner->id)->lock('FOR KEY SHARE')->firstOrFail();
            $owner->properties()->where('status', 'approved')->where('owner_paused', false)->whereHas('roomOptions', fn ($query) => $query->where('available_units', '>', 0))->whereHas('roomOptions', fn ($query) => $query->where('availability_confirmed_at', '<=', now()->subDays(self::REMIND_DAYS)))
                ->lockForUpdate()->with('roomOptions')->chunkById(100, function ($properties) use ($owner): void {
                    foreach ($properties as $property) {
                        $oldest = $property->roomOptions->min('availability_confirmed_at');
                        if (! $oldest || $oldest->gt(now()->subDays(self::REMIND_DAYS))) {
                            continue;
                        }
                        $age = (int) $oldest->diffInDays(now());
                        $stage = $age >= self::HIDE_DAYS ? 'expired' : ($age >= self::WARNING_DAYS ? 'warning' : 'due');
                        $hidden = self::summary($property)['status'] === 'hidden';
                        $title = $hidden ? 'Listing hidden: confirm vacancies for '.$property->title : ($stage === 'expired' ? 'Some rooms are hidden: refresh availability for '.$property->title : ($stage === 'warning' ? 'Availability expires soon: confirm vacancies for '.$property->title : 'Is your place still available? Confirm vacancies for '.$property->title));
                        app(ActivityRecorder::class)->notify($owner->id, 'availability:'.$property->id.':'.$oldest->timestamp.':'.$stage, 'availability', Str::limit($title, 157), '/landlord/properties/'.$property->id.'#rooms');
                    }
                });
        }, 3);
    }

    public function resolveReminders(Property $property): void
    {
        if (self::summary($property)['rooms_needing_confirmation'] === 0) {
            DB::table('user_notifications')->where('recipient_id', $property->landlord_id)->where('kind', 'availability')->where('path', '/landlord/properties/'.$property->id.'#rooms')->whereNull('read_at')->update(['read_at' => now()]);
        }
    }
}
