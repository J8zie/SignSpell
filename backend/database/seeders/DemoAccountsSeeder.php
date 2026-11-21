<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

// Demo accounts for presentations and testing; safe to re-run (keyed on username).
class DemoAccountsSeeder extends Seeder
{
    /** Demo logins: username => [role, first, last, email, password]. */
    private const ACCOUNTS = [
        'admin' => ['admin', 'Demo', 'Admin', 'admin@signspell.com', 'admin123'],
        'learner' => ['learner', 'Demo', 'Learner', 'learner@signspell.com', 'learner123'],
        'superadmin' => ['super_admin', 'Demo', 'SuperAdmin', 'superadmin@signspell.com', 'superadmin123'],
    ];

    public function run(): void
    {
        foreach (self::ACCOUNTS as $username => [$role, $first, $last, $email, $password]) {
            $user = User::updateOrCreate(
                ['username' => $username],
                ['role' => $role, 'status' => 'active', 'password' => $password],
            );
            $user->info()->updateOrCreate(
                ['user_id' => $user->user_id],
                ['first_name' => $first, 'last_name' => $last, 'email' => $email],
            );
        }
    }
}
