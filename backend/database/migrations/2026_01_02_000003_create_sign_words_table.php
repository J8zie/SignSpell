<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sign_words', function (Blueprint $table) {
            $table->uuid('sign_id');
            $table->uuid('word_sign_id');
            $table->unsignedSmallInteger('position');

            $table->primary(['sign_id', 'position']);
            // Deleting a phrase removes its word list; deleting a word that phrases still use is blocked.
            $table->foreign('sign_id')->references('sign_id')->on('signs')->cascadeOnDelete();
            $table->foreign('word_sign_id')->references('sign_id')->on('signs')->restrictOnDelete();
            $table->index('word_sign_id');
        });

        // A phrase cannot list itself as one of its words (Postgres only; SQLite has no ADD CONSTRAINT).
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table sign_words add constraint sign_words_no_self_ref check (sign_id <> word_sign_id)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sign_words');
    }
};
