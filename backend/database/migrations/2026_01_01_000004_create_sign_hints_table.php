<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sign_hints', function (Blueprint $table) {
            $table->uuid('sign_id')->primary();
            $table->string('text', 200);
            $table->timestamp('updated_at')->useCurrent();

            $table->foreign('sign_id')->references('sign_id')->on('signs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sign_hints');
    }
};
