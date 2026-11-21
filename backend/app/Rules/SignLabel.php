<?php

namespace App\Rules;

use App\Models\Sign;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class SignLabel implements ValidationRule
{
    // Remembers which sign to ignore when checking for duplicates (the one being edited).
    public function __construct(private ?string $ignoreSignId = null) {}

    // Checks the label is allowed for the chosen sign type and not already taken.
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $type = request()->input('signType');
        $normalized = self::normalize(is_string($value) ? $value : '');
        $message = self::problem($normalized, is_string($type) ? $type : null);

        if ($message !== null) {
            $fail($message);

            return;
        }

        $exists = Sign::query()
            ->where('sign_type', $type)
            ->where('label', $normalized)
            ->when($this->ignoreSignId, fn ($query) => $query->where('sign_id', '!=', $this->ignoreSignId))
            ->exists();

        if ($exists) {
            $fail('This word already exists.');
        }
    }

    // Cleans up a label: trims it, collapses spaces, and makes it uppercase.
    public static function normalize(string $label): string
    {
        $collapsed = preg_replace('/\s+/u', ' ', trim($label)) ?? trim($label);

        return mb_strtoupper($collapsed, 'UTF-8');
    }

    // Returns the problem message for a label, or null when the label is fine.
    public static function problem(string $normalized, ?string $type): ?string
    {
        if (! in_array($type, ['letter', 'word', 'sentence'], true)) {
            return 'Choose a letter, word, or sentence.';
        }

        if (! preg_match('/^[A-Z]+( [A-Z]+)*$/', $normalized)) {
            return self::typeMessage($type);
        }

        $words = substr_count($normalized, ' ') + 1;
        $letters = strlen(str_replace(' ', '', $normalized));
        $wordMin = (int) config('signspell.label.word_min');
        $wordMax = (int) config('signspell.label.word_max');
        $sentenceMin = (int) config('signspell.label.sentence_min_words');
        $sentenceMax = (int) config('signspell.label.sentence_max_words');

        $ok = match ($type) {
            'letter' => $words === 1 && $letters === 1,
            'word' => $words === 1 && $letters >= $wordMin && $letters <= $wordMax,
            'sentence' => $words >= $sentenceMin && $words <= $sentenceMax,
            default => false,
        };

        return $ok ? null : self::typeMessage($type);
    }

    // Returns the friendly error message for a given sign type.
    public static function typeMessage(string $type): string
    {
        return match ($type) {
            'letter' => 'A letter sign has exactly one letter.',
            'word' => 'A word is '.(int) config('signspell.label.word_min').' to '.(int) config('signspell.label.word_max').' letters with no spaces.',
            'sentence' => 'A sentence has '.self::spell((int) config('signspell.label.sentence_min_words')).' to '.self::spell((int) config('signspell.label.sentence_max_words')).' words.',
            default => 'Choose a letter, word, or sentence.',
        };
    }

    /** Turns a number into a word (2 -> "two") for the error messages. */
    private static function spell(int $n): string
    {
        return [1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five', 6 => 'six', 7 => 'seven', 8 => 'eight', 9 => 'nine', 10 => 'ten'][$n] ?? (string) $n;
    }
}
