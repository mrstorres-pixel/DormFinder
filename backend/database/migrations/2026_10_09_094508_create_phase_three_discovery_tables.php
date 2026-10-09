<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('campuses', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('name', 150);
            $table->string('address');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('source_url');
            $table->string('reference_note');
            $table->boolean('active')->default(true);
            $table->timestampsTz();
        });
        DB::statement('ALTER TABLE campuses ADD CONSTRAINT campus_coordinates_valid CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)');
        DB::table('campuses')->insert([
            'slug' => 'tip-manila-casal', 'name' => 'TIP Manila — P. Casal', 'address' => '363 P. Casal St., Quiapo, Manila',
            'latitude' => 14.5953363, 'longitude' => 120.9881329,
            'source_url' => 'https://www.openstreetmap.org/way/174249109',
            'reference_note' => 'Approximate campus boundary center from OpenStreetMap way 174249109, version 11, checked October 9, 2026. Not an entrance or walking route.',
            'active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        Schema::create('favorites', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('property_id')->constrained('properties')->restrictOnDelete();
            $table->timestampsTz();
            $table->unique(['student_id', 'property_id']);
            $table->index('property_id');
            $table->index(['student_id', 'id']);
        });
        DB::statement("CREATE INDEX properties_public_recent ON properties (approved_at DESC, id DESC) WHERE status = 'approved'");
        DB::statement('CREATE INDEX room_options_discovery ON room_options (property_id, price_basis, monthly_rent_centavos) WHERE deleted_at IS NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('campuses');
        DB::statement('DROP INDEX IF EXISTS properties_public_recent');
        DB::statement('DROP INDEX IF EXISTS room_options_discovery');
    }
};
