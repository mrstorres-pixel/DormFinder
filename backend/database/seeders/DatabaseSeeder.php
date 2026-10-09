<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->command?->info('No accounts or listings are seeded in the integration phase. Register through the app; create administrators with dormfinder:admin.');
    }
}
