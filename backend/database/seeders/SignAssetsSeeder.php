<?php

namespace Database\Seeders;

use App\Http\Controllers\SignController;
use App\Models\Sign;
use App\Models\SignHint;
use App\Services\ImageStore;
use Illuminate\Database\Seeder;

/**
 * Gives the bundled dataset signs their pictures and hints.
 * Letter art was cropped from the ASL alphabet sheet into database/seeders/data/images/letters/.
 * Uploads go through the same ImageStore the API uses, so they land in Cloudinary like teacher uploads.
 * Safe to re-run: signs that already have an image are left alone, hints are updated in place.
 */
class SignAssetsSeeder extends Seeder
{
    /** File name (without extension) in seeders/data/images for each sign, keyed "type:label". */
    private const IMAGES = [
        'sentence:HOW ARE YOU' => 'sentence_how_are_you',
        'word:HOW' => 'how_word',
        'word:YOU' => 'you_word',
    ];

    /** Hint text per letter (keyed by label); words and the sentence get their own entries below. */
    private const LETTER_HINTS = [
        'A' => 'Make a fist and hold your thumb alongside your index finger.',
        'B' => 'Hold up a flat hand, fingers together, thumb tucked across your palm.',
        'C' => 'Curve your hand into a loose C shape.',
        'D' => 'Point your index finger up and curl the other fingers into your palm.',
        'E' => 'Curl all fingers and tuck your thumb in, like a loose claw.',
        'F' => 'Touch thumb to index finger in a circle and hold the other three fingers up.',
        'G' => 'Point your index finger and thumb sideways, like a gun.',
        'H' => 'Hold your index and middle fingers out together, sideways.',
        'I' => 'Make a fist and hold up only your pinky.',
        'J' => 'Hold up your pinky and draw a J in the air with it.',
        'K' => 'Hold up index and middle fingers in a V and touch your thumb to the middle finger.',
        'L' => 'Hold up your thumb and pinky and fold the other fingers down.',
        'M' => 'Tuck your thumb under three folded fingers.',
        'N' => 'Tuck your thumb under two folded fingers.',
        'O' => 'Curve all fingers and thumb into a round O shape.',
        'P' => 'Point your index and middle fingers down in a K shape.',
        'Q' => 'Point your index finger and thumb down, like a G aimed at the floor.',
        'R' => 'Cross your index and middle fingers.',
        'S' => 'Make a fist.',
        'T' => 'Tuck your thumb between your index and middle fingers.',
        'U' => 'Hold up your index and middle fingers together.',
        'V' => 'Hold up your index and middle fingers in a V.',
        'W' => 'Hold up your index, middle and ring fingers in a W.',
        'Y' => 'Hold up your thumb and pinky like a Y.',
        'Z' => 'Draw the letter Z in the air with your index finger.',
    ];

    private const OTHER_HINTS = [
        'word:HOW' => 'One of the two signs that make up "HOW ARE YOU".',
        'word:YOU' => 'One of the two signs that make up "HOW ARE YOU".',
        'sentence:HOW ARE YOU' => 'In ASL this phrase is signed HOW + YOU — there is no separate sign for "are".',
    ];

    public function run(): void
    {
        $images = app(ImageStore::class);
        $this->seedImages($images);
        $this->seedHints();
        SignController::forgetSignsCache();
    }

    // Uploads each bundled picture to the image store and points its sign at it.
    private function seedImages(ImageStore $images): void
    {
        $dir = database_path('seeders/data/images');

        Sign::query()->where('sign_type', 'letter')->whereNotNull('label')->get()->each(function (Sign $sign) use ($images, $dir) {
            $this->attachImage($images, $sign, $dir.'/letters/'.$sign->label.'.png');
        });

        foreach (self::IMAGES as $key => $file) {
            [$type, $label] = explode(':', $key, 2);
            $sign = Sign::query()->where('sign_type', $type)->where('label', $label)->first();
            if ($sign) {
                $this->attachImage($images, $sign, $dir.'/'.$file.'.png');
            }
        }
    }

    // Stores one file for a sign unless it already has an image.
    private function attachImage(ImageStore $images, Sign $sign, string $path): void
    {
        if ($sign->image_public_id || ! is_file($path)) {
            return;
        }

        $stored = $images->upload($path, 'signs');
        $sign->forceFill([
            'image_url' => $stored['url'],
            'image_public_id' => $stored['public_id'],
        ])->save();
    }

    // Writes the hint for every dataset sign (letters plus the phrase words and sentence).
    private function seedHints(): void
    {
        $hints = [];
        foreach (self::LETTER_HINTS as $label => $text) {
            $hints["letter:$label"] = $text;
        }
        $hints += self::OTHER_HINTS;

        foreach ($hints as $key => $text) {
            [$type, $label] = explode(':', $key, 2);
            $sign = Sign::query()->where('sign_type', $type)->where('label', $label)->first();
            if (! $sign) {
                continue;
            }
            SignHint::query()->updateOrCreate(
                ['sign_id' => $sign->sign_id],
                ['text' => $text],
            );
        }
    }
}
