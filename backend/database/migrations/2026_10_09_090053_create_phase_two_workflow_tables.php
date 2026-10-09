<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('property_id')->constrained()->restrictOnDelete();
            $table->string('name', 100);
            $table->string('inventory_type', 20);
            $table->string('price_basis', 20);
            $table->unsignedInteger('capacity');
            $table->unsignedInteger('total_units');
            $table->unsignedInteger('available_units');
            $table->unsignedBigInteger('monthly_rent_centavos');
            $table->unsignedBigInteger('deposit_centavos')->default(0);
            $table->unsignedInteger('advance_months')->default(0);
            $table->text('utilities_notes');
            $table->timestampTz('availability_confirmed_at');
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->index(['property_id', 'deleted_at']);
        });
        DB::statement('CREATE UNIQUE INDEX room_options_active_name_unique ON room_options (property_id, lower(name)) WHERE deleted_at IS NULL');
        DB::statement("ALTER TABLE room_options ADD CONSTRAINT room_option_inventory_valid CHECK ((inventory_type = 'bedspace' AND price_basis = 'per_person') OR (inventory_type = 'whole_room' AND price_basis = 'per_room'))");
        DB::statement('ALTER TABLE room_options ADD CONSTRAINT room_option_numbers_valid CHECK (capacity BETWEEN 1 AND 20 AND total_units BETWEEN 1 AND 1000 AND available_units BETWEEN 0 AND total_units AND monthly_rent_centavos BETWEEN 1 AND 100000000 AND deposit_centavos BETWEEN 0 AND 100000000 AND advance_months BETWEEN 0 AND 12)');
        Schema::create('room_option_fees', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('room_option_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('frequency', 20);
            $table->unsignedBigInteger('amount_centavos');
            $table->index('room_option_id');
        });
        DB::statement("ALTER TABLE room_option_fees ADD CONSTRAINT room_option_fee_valid CHECK (frequency IN ('monthly','one_time') AND amount_centavos BETWEEN 0 AND 100000000)");
        Schema::create('listing_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('property_id')->constrained()->restrictOnDelete();
            $table->foreignId('administrator_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('revision');
            $table->string('decision', 20);
            $table->text('reason')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['property_id', 'created_at']);
            $table->index('administrator_id');
        });
        DB::statement("ALTER TABLE listing_reviews ADD CONSTRAINT listing_review_decision_valid CHECK (decision IN ('approved','rejected'))");
        Schema::create('inquiries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('property_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('landlord_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('room_option_id')->nullable()->constrained()->restrictOnDelete();
            $table->jsonb('listing_snapshot');
            $table->timestampTz('last_message_at');
            $table->timestampsTz();
            $table->unique(['student_id', 'property_id']);
            $table->index(['landlord_id', 'last_message_at']);
            $table->index(['student_id', 'last_message_at']);
            $table->index('property_id');
            $table->index('room_option_id');
        });
        Schema::create('inquiry_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('inquiry_id')->constrained()->restrictOnDelete();
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            $table->uuid('client_id');
            $table->text('body');
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['inquiry_id', 'sender_id', 'client_id']);
            $table->index(['inquiry_id', 'id']);
            $table->index('sender_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inquiry_messages');
        Schema::dropIfExists('inquiries');
        Schema::dropIfExists('listing_reviews');
        Schema::dropIfExists('room_option_fees');
        Schema::dropIfExists('room_options');
    }
};
