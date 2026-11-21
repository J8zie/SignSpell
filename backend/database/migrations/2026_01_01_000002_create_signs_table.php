<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signs', function (Blueprint $table) {
            $table->uuid('sign_id')->primary();
            $table->string('sign_type');
            $table->string('label');
            $table->text('image_url')->nullable();
            $table->text('image_public_id')->nullable();
            $table->uuid('userownership_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['sign_type', 'label']);
            $table->index('userownership_id');
            $table->index('label');
            $table->foreign('userownership_id')->references('user_id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('signs');
    }
};
