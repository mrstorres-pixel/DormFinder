<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedInteger('moderation_revision')->default(1);
        });
        Schema::create('listing_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('property_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->uuid('client_id');
            $table->string('category', 40);
            $table->text('body');
            $table->string('listing_title', 120);
            $table->string('status', 20)->default('open');
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('administrator_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('resolution_reason')->nullable();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();
            $table->unique(['student_id', 'client_id']);
            $table->index(['student_id', 'id']);
            $table->index(['status', 'id']);
            $table->index('property_id');
            $table->index('administrator_id');
        });
        DB::statement("CREATE UNIQUE INDEX listing_reports_one_open ON listing_reports (student_id, property_id) WHERE status = 'open'");
        DB::statement("ALTER TABLE listing_reports ADD CONSTRAINT report_values_valid CHECK (status IN ('open','resolved','dismissed') AND category IN ('misleading','inappropriate','duplicate','unavailable','other') AND revision > 0)");
        Schema::create('moderation_actions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('property_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('listing_report_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('action', 40);
            $table->string('before_status', 30);
            $table->string('after_status', 30);
            $table->unsignedInteger('revision');
            $table->text('reason');
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['property_id', 'id']);
            $table->index(['user_id', 'id']);
            $table->index('listing_report_id');
            $table->index('actor_id');
        });
        DB::statement('ALTER TABLE moderation_actions ADD CONSTRAINT moderation_target_required CHECK (property_id IS NOT NULL OR user_id IS NOT NULL)');
        DB::statement("INSERT INTO moderation_actions (actor_id,property_id,action,before_status,after_status,revision,reason,created_at) SELECT administrator_id,property_id,'listing_review','pending_review',decision,revision+1,COALESCE(reason,'Content review completed.'),created_at FROM listing_reviews ORDER BY id");
        Schema::create('user_notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('recipient_id')->constrained('users')->restrictOnDelete();
            $table->string('event_key', 150);
            $table->string('kind', 40);
            $table->string('title', 160);
            $table->string('path', 200);
            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['recipient_id', 'event_key']);
            $table->index(['recipient_id', 'id']);
        });
        DB::statement('CREATE INDEX user_notifications_unread ON user_notifications (recipient_id, id DESC) WHERE read_at IS NULL');
        if (DB::selectOne("select 1 from pg_roles where rolname = 'dormfinder_runtime'")) {
            DB::statement('REVOKE UPDATE, DELETE ON moderation_actions FROM dormfinder_runtime');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
        Schema::dropIfExists('moderation_actions');
        Schema::dropIfExists('listing_reports');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('moderation_revision');
        });
    }
};
