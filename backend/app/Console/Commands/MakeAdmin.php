<?php

namespace App\Console\Commands;

use App\Http\Requests\RegisterRequest;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class MakeAdmin extends Command
{
    protected $signature = 'signspell:make-admin {--force : Create another Super Admin even if one exists}';

    protected $description = 'Create the first Super Admin account';

    // Creates the first super admin account by asking questions in the terminal.
    public function handle(): int
    {
        if (User::query()->where('role', 'super_admin')->exists() && ! $this->option('force')) {
            $this->components->error('A Super Admin already exists.');

            return self::FAILURE;
        }

        // Bad answers are explained and asked again, up to 3 tries.
        $data = null;
        foreach (range(1, 3) as $try) {
            $data = [
                'firstName' => trim((string) $this->ask('First name')),
                'lastName' => trim((string) $this->ask('Last name')),
                'email' => mb_strtolower(trim((string) $this->ask('Email'))),
                'username' => trim((string) $this->ask('Username')),
                'password' => (string) $this->secret('Password'),
                'role' => 'super_admin',
            ];

            request()->merge($data);

            $validator = Validator::make($data, [
                'username' => RegisterRequest::usernameRules(),
                'password' => RegisterRequest::passwordRules(true),
                'firstName' => RegisterRequest::nameRules(),
                'lastName' => RegisterRequest::nameRules(),
                'email' => RegisterRequest::emailRules(),
            ], RegisterRequest::messageBag());

            if (! $validator->fails()) {
                break;
            }

            foreach ($validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            if ($try === 3) {
                return self::FAILURE;
            }

            $this->components->warn('Please try again.');
        }

        User::createWithInfo(
            $data['username'],
            $data['password'],
            'super_admin',
            $data['firstName'],
            $data['lastName'],
            $data['email'],
        );

        $this->components->info('Super Admin created.');

        return self::SUCCESS;
    }
}
