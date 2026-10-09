<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ActivityRecorder
{
    public function notify(int $recipient, string $event, string $kind, string $title, string $path): void
    {
        DB::table('user_notifications')->insertOrIgnore([
            'recipient_id' => $recipient, 'event_key' => $event, 'kind' => $kind,
            'title' => $title, 'path' => $path, 'created_at' => now(),
        ]);
    }

    public function audit(int $actor, string $action, string $before, string $after, int $revision, string $reason, ?int $property = null, ?int $user = null, ?int $report = null): int
    {
        return DB::table('moderation_actions')->insertGetId([
            'actor_id' => $actor, 'action' => $action, 'before_status' => $before, 'after_status' => $after,
            'revision' => $revision, 'reason' => $reason, 'property_id' => $property,
            'user_id' => $user, 'listing_report_id' => $report, 'created_at' => now(),
        ]);
    }
}
