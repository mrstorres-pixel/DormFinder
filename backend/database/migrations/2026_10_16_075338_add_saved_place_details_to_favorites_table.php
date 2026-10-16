<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('favorites', function (Blueprint $table) {
            $table->foreignId('room_option_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->text('note')->default('');
            $table->unsignedInteger('revision')->default(1);
            $table->jsonb('listing_snapshot')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('favorites', function (Blueprint $table) {
            $table->dropConstrainedForeignId('room_option_id');
            $table->dropColumn(['note', 'revision', 'listing_snapshot']);
        });
    }
};
