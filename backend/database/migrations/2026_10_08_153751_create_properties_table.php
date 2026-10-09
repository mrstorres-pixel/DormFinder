<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('landlord_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->string('property_type', 30)->default('dormitory');
            $table->string('address')->nullable();
            $table->string('city', 100)->default('Manila');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('status', 30)->default('draft');
            $table->unsignedInteger('revision')->default(1);
            $table->text('moderation_reason')->nullable();
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->boolean('is_demo')->default(false);
            $table->timestampsTz();
            $table->index(['landlord_id', 'status']);
            $table->index(['status', 'property_type']);
        });
        DB::statement("ALTER TABLE properties ADD CONSTRAINT property_status_valid CHECK (status IN ('draft','pending_review','approved','rejected','suspended','archived'))");
        DB::statement("ALTER TABLE properties ADD CONSTRAINT property_type_valid CHECK (property_type IN ('dormitory','apartment','boarding_house','rental_room'))");
        DB::statement('ALTER TABLE properties ADD CONSTRAINT property_coordinates_valid CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))');
    }

    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
