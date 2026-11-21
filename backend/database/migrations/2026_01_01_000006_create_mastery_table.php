<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mastery', function (Blueprint $table) {
            $table->uuid('mastery_id')->primary();
            $table->uuid('learners_id');
            $table->uuid('sign_id');
            $table->unsignedInteger('attempts_count')->default(0);
            $table->decimal('correct_avg', 8, 6)->default(0);
            $table->string('mastery_level');
            $table->timestamp('updated_at')->useCurrent();

            $table->unique(['learners_id', 'sign_id']);
            $table->foreign('learners_id')->references('user_id')->on('users')->cascadeOnDelete();
            $table->foreign('sign_id')->references('sign_id')->on('signs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mastery');
    }
};
