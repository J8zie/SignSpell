<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Only the three types the app can write (SignRequest already validates the same list).
        // PostgreSQL only: SQLite cannot add a constraint to an existing table.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table signs add constraint signs_sign_type_check check (sign_type in ('letter', 'word', 'sentence'))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table signs drop constraint if exists signs_sign_type_check');
        }
    }
};
