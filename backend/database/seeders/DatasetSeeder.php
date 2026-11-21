<?php

namespace Database\Seeders;

use App\Models\Sign;
use App\Models\SignSample;
use App\Models\SignWord;
use Illuminate\Database\Seeder;

class DatasetSeeder extends Seeder
{
    // Loads the bundled test landmark files into signs, sign_samples and sign_words; safe to run twice.
    public function run(): void
    {
        $this->seedLetters(database_path('seeders/data/test_letters_normalized.json'));
        $this->seedSentence(database_path('seeders/data/test_sentence_how_are_you.json'));
    }

    // Creates one letter sign per entry and stores its single-frame landmark sample.
    private function seedLetters(string $path): void
    {
        foreach ($this->readJson($path) as $entry) {
            $sign = $this->upsertSign($entry['type'], $entry['label'], $entry['source']);
            $this->upsertSample($sign, $entry['source'], 'letter:'.$entry['label'], null, $entry['landmarks'], $entry['frame_count']);
        }
    }

    // Creates the phrase sign, a word sign + sample for each word, and the ordered sign_words links.
    private function seedSentence(string $path): void
    {
        $data = $this->readJson($path);
        $sign = $this->upsertSign($data['type'], $data['label'], $data['source']);

        foreach ($data['word_samples'] as $position => $word) {
            $wordSign = $this->upsertSign($word['type'], $word['label'], $data['source']);
            $this->upsertSample($wordSign, $data['source'], $data['label'].':'.$word['label'], null, $word['landmarks'], $word['frame_count']);
            SignWord::updateOrCreate(
                ['sign_id' => $sign->sign_id, 'position' => $position],
                ['word_sign_id' => $wordSign->sign_id],
            );
        }
    }

    // Finds the sign by type+label or creates it, keeping the dataset source for credit.
    private function upsertSign(string $type, string $label, string $source): Sign
    {
        return Sign::firstOrCreate(
            ['sign_type' => $type, 'label' => $label],
            ['source' => $source],
        );
    }

    // Inserts or refreshes one landmark sample, keyed by (source, source_sequence_id) so re-runs are safe.
    private function upsertSample(Sign $sign, string $source, string $sequenceId, ?string $signerRef, array $landmarks, int $frameCount): void
    {
        SignSample::updateOrCreate(
            ['source' => $source, 'source_sequence_id' => $sequenceId],
            ['sign_id' => $sign->sign_id, 'signer_ref' => $signerRef, 'landmarks' => $landmarks, 'frame_count' => $frameCount],
        );
    }

    // Decodes a JSON file from database/seeders/data.
    private function readJson(string $path): array
    {
        return json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }
}
