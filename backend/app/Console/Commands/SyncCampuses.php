<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncCampuses extends Command
{
    protected $signature = 'dormfinder:campuses {--apply : Add missing campus entries and metadata}';

    protected $description = 'Preview or add sourced campus references without replacing existing coordinates';

    public function handle(): int
    {
        $rows = json_decode(file_get_contents(database_path('campus-directory.json')), true, 512, JSON_THROW_ON_ERROR);
        if (! $this->option('apply')) {
            $this->table(['Campus', 'Location source'], array_map(fn (array $row): array => [$row['name'], $row['source_url']], $rows));
            $this->info('Preview only. Use --apply to add missing records. Existing coordinates and names are preserved.');

            return self::SUCCESS;
        }
        DB::transaction(function () use ($rows): void {
            foreach ($rows as $row) {
                unset($row['official_source_url']);
                $row['aliases'] = json_encode($row['aliases']);
                DB::table('campuses')->insertOrIgnore([...$row, 'active' => true, 'created_at' => now(), 'updated_at' => now()]);
                DB::table('campuses')->where('slug', $row['slug'])->whereNull('institution_name')->update([
                    'institution_name' => $row['institution_name'], 'city' => $row['city'], 'aliases' => $row['aliases'],
                ]);
            }
        });
        $this->info('Campus directory added; existing locations preserved.');

        return self::SUCCESS;
    }
}
