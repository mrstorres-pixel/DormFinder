<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdministrator extends Command
{
    protected $signature = 'dormfinder:admin {email} {--name=Administrator}';

    protected $description = 'Create an administrator with a hidden password prompt; never changes existing accounts.';

    public function handle(): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('Use an interactive terminal so the password can be entered securely.');

            return self::FAILURE;
        }
        $data = [
            'email' => mb_strtolower(trim($this->argument('email'))),
            'name' => $this->option('name'),
            'password' => $this->secret('Administrator password (12+ characters, letters and numbers)'),
            'password_confirmation' => $this->secret('Confirm password'),
        ];
        $validator = Validator::make($data, [
            'email' => ['required', 'email', 'unique:users,email'],
            'name' => ['required', 'string', 'max:100'],
            'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }
        $user = new User(collect($data)->only(['email', 'name', 'password'])->all());
        $user->role = 'admin';
        $user->status = 'active';
        $user->save();
        $this->info('Administrator created. No password has been logged.');

        return self::SUCCESS;
    }
}
