<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sign_samples', function (Blueprint $table) {
            $table->uuid('sample_id')->primary();
            $table->uuid('sign_id');
            // License credit: which dataset this sample came from (required on every row).
            $table->string('source');
            // The dataset's participant id for this sample (nullable).
            $table->string('signer_ref')->nullable();
            // The dataset's own id for this sample, so re-imports can be skipped (nullable).
            $table->string('source_sequence_id')->nullable();
            // MediaPipe hand landmarks: frames x 21 points x {x,y,z}, stored as jsonb.
            $table->jsonb('landmarks');
            // Letters use a single-frame sample (frame_count = 1); words and sentences use sequences.
            $table->unsignedSmallInteger('frame_count');
            $table->timestamp('created_at')->useCurrent();

            // One sample per (dataset, dataset-row): lets an import command run twice safely.
            $table->unique(['source', 'source_sequence_id'], 'sign_samples_source_seq_unique');
            $table->index('sign_id');
            $table->index(['sign_id', 'source']);
            $table->foreign('sign_id')->references('sign_id')->on('signs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sign_samples');
    }
};
