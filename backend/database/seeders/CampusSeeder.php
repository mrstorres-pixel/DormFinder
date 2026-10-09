<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CampusSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('campuses')->insertOrIgnore([
            'slug' => 'tip-manila-casal', 'name' => 'TIP Manila — P. Casal', 'address' => '363 P. Casal St., Quiapo, Manila',
            'latitude' => 14.5953363, 'longitude' => 120.9881329,
            'source_url' => 'https://www.openstreetmap.org/way/174249109',
            'reference_note' => 'Approximate campus boundary center from OpenStreetMap way 174249109, version 11, checked October 9, 2026. Not an entrance or walking route.',
            'active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
