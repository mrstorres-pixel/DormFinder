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
        Schema::table('properties', function (Blueprint $table): void {
            $table->boolean('owner_paused')->default(false);
        });
        Schema::table('campuses', function (Blueprint $table): void {
            $table->unsignedInteger('revision')->default(1);
        });
        Schema::create('campus_suggestions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->uuid('client_id');
            $table->string('name', 150);
            $table->string('city', 100);
            $table->string('address');
            $table->string('source_url')->nullable();
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('campus_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('administrator_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('resolution_note', 1000)->nullable();
            $table->timestampsTz();
            $table->unique(['user_id', 'client_id']);
            $table->index(['status', 'id']);
            $table->index(['user_id', 'id']);
            $table->index('campus_id');
            $table->index('administrator_id');
        });
        DB::statement("CREATE UNIQUE INDEX campus_suggestions_one_pending ON campus_suggestions(user_id, lower(name), lower(city)) WHERE status = 'pending'");
        DB::statement("ALTER TABLE campus_suggestions ADD CONSTRAINT campus_suggestion_values CHECK (status IN ('pending','added','duplicate','declined') AND revision > 0)");
        Schema::create('campus_actions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campus_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 30);
            $table->unsignedInteger('revision');
            $table->jsonb('changes');
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['campus_id', 'id']);
            $table->index('actor_id');
        });
        DB::statement(<<<'SQL'
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dormfinder_runtime') THEN
                    REVOKE ALL ON campus_suggestions, campus_actions FROM PUBLIC;
                    GRANT SELECT, INSERT, UPDATE ON campus_suggestions TO dormfinder_runtime;
                    GRANT SELECT, INSERT ON campus_actions TO dormfinder_runtime;
                    GRANT USAGE, SELECT ON SEQUENCE campus_suggestions_id_seq, campus_actions_id_seq TO dormfinder_runtime;
                    ALTER TABLE campus_suggestions ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE campus_actions ENABLE ROW LEVEL SECURITY;
                    CREATE POLICY trusted_server ON campus_suggestions TO dormfinder_runtime USING (true) WITH CHECK (true);
                    CREATE POLICY trusted_server ON campus_actions TO dormfinder_runtime USING (true) WITH CHECK (true);
                END IF;
            END $$
            SQL);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campus_actions');
        Schema::dropIfExists('campus_suggestions');
        Schema::table('campuses', fn (Blueprint $table) => $table->dropColumn('revision'));
        Schema::table('properties', fn (Blueprint $table) => $table->dropColumn('owner_paused'));
    }
};
