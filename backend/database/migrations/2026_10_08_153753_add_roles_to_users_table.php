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
            $table->string('role', 20)->default('student');
            $table->string('status', 20)->default('active');
            $table->index(['role', 'status']);
        });
        DB::statement("ALTER TABLE users ADD CONSTRAINT user_role_valid CHECK (role IN ('student','landlord','admin'))");
        DB::statement("ALTER TABLE users ADD CONSTRAINT user_status_valid CHECK (status IN ('active','suspended'))");
        DB::statement('CREATE UNIQUE INDEX users_normalized_email_unique ON users (lower(email))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX users_normalized_email_unique');
        DB::statement('ALTER TABLE users DROP CONSTRAINT user_role_valid, DROP CONSTRAINT user_status_valid');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['role', 'status']));
    }
};
