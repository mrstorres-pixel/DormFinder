<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table): void {
            $table->jsonb('amenities')->nullable();
            $table->text('house_rules')->nullable();
        });
        Schema::table('campuses', function (Blueprint $table): void {
            $table->string('institution_name', 150)->nullable();
            $table->string('city', 100)->nullable();
            $table->jsonb('aliases')->nullable();
        });
        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('preferred_campus_id')->nullable()->constrained('campuses')->restrictOnDelete();
        });
        Schema::table('listing_reports', function (Blueprint $table): void {
            $table->string('listing_title', 150)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('preferred_campus_id');
        });
        Schema::table('campuses', function (Blueprint $table): void {
            $table->dropColumn(['institution_name', 'city', 'aliases']);
        });
        Schema::table('properties', function (Blueprint $table): void {
            $table->dropColumn(['amenities', 'house_rules']);
        });
        // Keep the widened snapshot column to preserve existing reports.
    }
};
