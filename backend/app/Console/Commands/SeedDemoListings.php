<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\DemoListings;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class SeedDemoListings extends Command
{
    protected $signature = 'dormfinder:demo-listings
        {--apply : Add the sample dataset; default only shows the plan}
        {--administrator= : Existing active administrator email}
        {--password-file= : Private file holding the dedicated demo owner password}
        {--production-project= : Explicit approved Supabase project reference}';

    protected $description = 'Add labeled fictional demo listings once; preserve existing accounts, passwords and edited samples.';

    public function handle(DemoListings $listings): int
    {
        if (! $this->option('apply')) {
            $this->table(['Sample listing', 'Planned state'], array_map(fn (array $entry): array => [$entry['title'], $entry['target_status']], $listings->catalog()));
            $this->info('Plan only: 16 public and 3 private samples. No records or files changed.');

            return self::SUCCESS;
        }
        if ($this->laravel->isProduction() && ($this->option('production-project') !== 'zujrpipjkgwqwlipgpwe'
            || config('database.connections.pgsql.username') !== 'dormfinder_runtime.zujrpipjkgwqwlipgpwe'
            || config('database.connections.pgsql.search_path') !== 'dormfinder'
            || config('filesystems.default') !== 's3'
            || config('filesystems.disks.s3.bucket') !== 'property-photos')) {
            $this->error('The approved production target was not explicitly confirmed. No changes made.');

            return self::FAILURE;
        }
        $reviewer = User::query()->where('email', mb_strtolower(trim((string) $this->option('administrator'))))->where('role', 'admin')->where('status', 'active')->first();
        $path = $this->option('password-file');
        if (! $reviewer || ! is_string($path) || ! is_file($path) || ! is_readable($path) || filesize($path) > 1024) {
            $this->error('Supply an existing active administrator and a valid private owner password file. No changes made.');

            return self::FAILURE;
        }
        $password = trim(file_get_contents($path));
        if (Validator::make(['password' => $password], ['password' => [Password::min(12)->letters()->numbers()]])->fails()) {
            $this->error('The private owner password does not meet account requirements. No changes made.');

            return self::FAILURE;
        }
        $owner = User::query()->where('email', DemoListings::OWNER_EMAIL)->first();
        if ($owner && ($owner->name !== DemoListings::OWNER_NAME || $owner->role !== 'landlord' || $owner->status !== 'active' || ! Hash::check($password, $owner->password))) {
            $this->error('The reserved demo identity differs. Existing account and password preserved.');

            return self::FAILURE;
        }
        if (! $owner) {
            $owner = new User(['name' => DemoListings::OWNER_NAME, 'email' => DemoListings::OWNER_EMAIL, 'password' => $password]);
            $owner->role = 'landlord';
            $owner->status = 'active';
            $owner->save();
        }
        $result = $listings->populate($owner, $reviewer, fn (string $message) => $this->info($message));
        $this->line(json_encode($result, JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
