<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signs', function (Blueprint $table) {
            // Dataset credit for seeded signs; null for teacher/admin donations.
            $table->string('source')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('signs', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }
};
