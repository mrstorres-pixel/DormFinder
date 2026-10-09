<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_photos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('property_id')->constrained()->restrictOnDelete();
            $table->uuid('upload_id');
            $table->string('disk', 30);
            $table->string('storage_key')->unique();
            $table->string('caption', 160)->default('Property photo');
            $table->string('status', 30)->default('uploading');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestampsTz();
            $table->unique(['property_id', 'upload_id']);
            $table->index(['status', 'updated_at']);
        });
        DB::statement("ALTER TABLE property_photos ADD CONSTRAINT photo_status_valid CHECK (status IN ('uploading','ready','pending_deletion'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('property_photos');
    }
};
