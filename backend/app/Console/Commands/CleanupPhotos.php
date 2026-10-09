<?php

namespace App\Console\Commands;

use App\Models\PropertyPhoto;
use App\Services\PhotoStorage;
use Illuminate\Console\Command;

class CleanupPhotos extends Command
{
    protected $signature = 'dormfinder:photos-cleanup {--dry-run}';

    protected $description = 'Remove tracked failed/deleted uploads, including uploads abandoned for over an hour.';

    public function handle(PhotoStorage $storage): int
    {
        $failures = 0;
        PropertyPhoto::query()->where('status', 'pending_deletion')
            ->orWhere(fn ($query) => $query->where('status', 'uploading')->where('updated_at', '<', now()->subHour()))
            ->chunkById(100, function ($photos) use ($storage, &$failures): void {
                foreach ($photos as $photo) {
                    if ($this->option('dry-run')) {
                        $this->line('Eligible photo record: '.$photo->id);

                        continue;
                    }
                    $photo->update(['status' => 'pending_deletion']);
                    if (! $storage->delete($photo)) {
                        $failures++;
                    }
                }
            });
        $this->info($this->option('dry-run') ? 'Dry run complete.' : 'Cleanup complete; pending failures: '.$failures);

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }
}
