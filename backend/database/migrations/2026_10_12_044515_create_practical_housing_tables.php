<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shortlists', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $t->string('name', 80);
            $t->timestampsTz();
            $t->index(['student_id', 'id']);
        });
        Schema::create('shortlist_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('shortlist_id')->constrained()->cascadeOnDelete();
            $t->foreignId('property_id')->constrained()->restrictOnDelete();
            $t->foreignId('room_option_id')->nullable()->constrained()->nullOnDelete();
            $t->jsonb('listing_snapshot');
            $t->text('note')->default('');
            $t->unsignedInteger('revision')->default(1);
            $t->timestampsTz();
            $t->unique(['shortlist_id', 'property_id']);
            $t->index('property_id');
            $t->index('room_option_id');
        });
        Schema::create('viewing_requests', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('property_id')->constrained()->restrictOnDelete();
            $t->foreignId('room_option_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('landlord_id')->constrained('users')->restrictOnDelete();
            $t->uuid('client_id');
            $t->jsonb('listing_snapshot');
            $t->timestampTz('requested_start');
            $t->timestampTz('starts_at');
            $t->string('status', 20)->default('requested');
            $t->text('student_note')->default('');
            $t->text('owner_note')->default('');
            $t->unsignedInteger('revision')->default(1);
            $t->timestampsTz();
            $t->unique(['student_id', 'client_id']);
            $t->index(['student_id', 'status', 'starts_at']);
            $t->index(['landlord_id', 'status', 'starts_at']);
            $t->index('property_id');
            $t->index('room_option_id');
        });
        DB::statement("CREATE UNIQUE INDEX viewing_one_active ON viewing_requests (student_id, property_id) WHERE status IN ('requested','proposed')");
        DB::statement("ALTER TABLE viewing_requests ADD CONSTRAINT viewing_values_valid CHECK (revision > 0 AND status IN ('requested','proposed','accepted','declined','cancelled'))");
        DB::statement('ALTER TABLE shortlist_items ADD CONSTRAINT shortlist_revision_valid CHECK (revision > 0)');
        if (DB::selectOne("select 1 from pg_roles where rolname = 'dormfinder_runtime'")) {
            DB::statement('REVOKE DELETE ON viewing_requests FROM dormfinder_runtime');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('viewing_requests');
        Schema::dropIfExists('shortlist_items');
        Schema::dropIfExists('shortlists');
    }
};
