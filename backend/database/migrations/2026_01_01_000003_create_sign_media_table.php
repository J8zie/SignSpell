<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sign_media', function (Blueprint $table) {
            $table->uuid('media_id')->primary();
            $table->uuid('sign_id');
            $table->string('type');
            $table->unsignedInteger('sequence')->nullable();
            $table->text('url');
            $table->text('public_id');
            $table->string('name');

            $table->foreign('sign_id')->references('sign_id')->on('signs')->cascadeOnDelete();
            $table->unique(['sign_id', 'sequence']);
        });

        DB::statement("create unique index sign_media_one_video_per_sign on sign_media (sign_id) where type = 'video'");
    }

    public function down(): void
    {
        Schema::dropIfExists('sign_media');
    }
};
