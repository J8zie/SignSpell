<?php

namespace App\Services;

use App\Models\Attempt;
use App\Models\Mastery;
use App\Models\Sign;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class MasteryService
{
    /** Saves one attempt and updates the learner's mastery for that sign.
     *
     * @return array{attempt: Attempt, mastery: Mastery}
     */
    public function recordAttempt(User $learner, Sign $sign, string $predictedLabel, float $confidence, bool $isCorrect): array
    {
        try {
            return $this->record($learner, $sign, $predictedLabel, $confidence, $isCorrect);
        } catch (UniqueConstraintViolationException) {
            // Two simultaneous first attempts raced to create the mastery row, so retry now that it exists.
            return $this->record($learner, $sign, $predictedLabel, $confidence, $isCorrect);
        }
    }

    /** Does the actual attempt save and mastery update inside a transaction.
     *
     * @return array{attempt: Attempt, mastery: Mastery}
     */
    private function record(User $learner, Sign $sign, string $predictedLabel, float $confidence, bool $isCorrect): array
    {
        return DB::transaction(function () use ($learner, $sign, $predictedLabel, $confidence, $isCorrect) {
            $attempt = Attempt::query()->create([
                'learners_id' => $learner->user_id,
                'sign_id' => $sign->sign_id,
                'predicted_label' => mb_strtoupper($predictedLabel, 'UTF-8'),
                'confidence' => $confidence,
                'is_correct' => $isCorrect,
            ]);

            $mastery = Mastery::query()
                ->where('learners_id', $learner->user_id)
                ->where('sign_id', $sign->sign_id)
                ->lockForUpdate()
                ->first();

            if (! $mastery) {
                $mastery = new Mastery([
                    'learners_id' => $learner->user_id,
                    'sign_id' => $sign->sign_id,
                    'attempts_count' => 0,
                    'correct_avg' => 0,
                    'mastery_level' => 'new',
                ]);
            }

            // Rebuild the correct count from whole numbers so rounding never drifts.
            $count = (int) $mastery->attempts_count;
            $correct = (int) round(((float) $mastery->correct_avg) * $count) + ($isCorrect ? 1 : 0);
            $average = $correct / ($count + 1);
            $mastery->attempts_count = $count + 1;
            $mastery->correct_avg = $average;
            $mastery->mastery_level = $this->levelFor($count + 1, $average);
            $mastery->save();

            return ['attempt' => $attempt, 'mastery' => $mastery];
        });
    }

    // Works out the mastery level from the attempt count and accuracy thresholds.
    public function levelFor(int $count, float $avg): string
    {
        if ($count === 0) {
            return 'new';
        }

        $masteredAttempts = (int) config('signspell.mastery.mastered_attempts');
        $masteredAvg = (float) config('signspell.mastery.mastered_avg');
        $familiarAttempts = (int) config('signspell.mastery.familiar_attempts');
        $familiarAvg = (float) config('signspell.mastery.familiar_avg');

        if ($count >= $masteredAttempts && $avg >= $masteredAvg) {
            return 'mastered';
        }

        if ($count >= $familiarAttempts && $avg >= $familiarAvg) {
            return 'familiar';
        }

        return 'learning';
    }
}
