<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Creates the append-only audit trail table.
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('audit_id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('username')->nullable();
            $table->string('user_role')->nullable();
            $table->string('action');
            $table->string('resource_type')->nullable();
            $table->string('resource_id')->nullable();
            $table->text('description')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
            $table->index('action');
            $table->index(['resource_type', 'resource_id']);
            $table->index('created_at');

            $table->foreign('user_id')->references('user_id')->on('users')->nullOnDelete();
        });
    }

    // Drops the audit trail table.
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
