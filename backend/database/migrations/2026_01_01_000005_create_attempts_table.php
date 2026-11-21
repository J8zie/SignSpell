<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attempts', function (Blueprint $table) {
            $table->uuid('attempts_id')->primary();
            $table->uuid('learners_id');
            $table->uuid('sign_id');
            $table->string('predicted_label');
            $table->decimal('confidence', 8, 6);
            $table->boolean('is_correct');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['learners_id', 'created_at']);
            $table->index('sign_id');
            $table->foreign('learners_id')->references('user_id')->on('users')->cascadeOnDelete();
            $table->foreign('sign_id')->references('sign_id')->on('signs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempts');
    }
};
