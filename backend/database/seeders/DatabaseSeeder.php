<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // The first account is created with: php artisan signspell:make-admin
        $this->call(DatasetSeeder::class);
    }
}
