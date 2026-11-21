<?php

use App\Rules\SignLabel;

it('normalizes labels', function () {
    expect(SignLabel::normalize('  hi   there  '))->toBe('HI THERE');
    expect(SignLabel::normalize('a'))->toBe('A');
});

it('accepts valid labels', function (string $type, string $label) {
    expect(SignLabel::problem(SignLabel::normalize($label), $type))->toBeNull();
})->with([
    ['letter', 'a'],
    ['letter', ' Z '],
    ['word', 'hi'],
    ['word', 'abcdefghijkl'],
    ['sentence', 'hi there'],
    ['sentence', 'one two three four five'],
]);

it('rejects invalid labels', function (string $type, string $label, string $message) {
    expect(SignLabel::problem(SignLabel::normalize($label), $type))->toBe($message);
})->with([
    ['letter', 'AB', 'A letter sign has exactly one letter.'],
    ['letter', 'A1', 'A letter sign has exactly one letter.'],
    ['word', 'A', 'A word is 2 to 12 letters with no spaces.'],
    ['word', 'HI THERE', 'A word is 2 to 12 letters with no spaces.'],
    ['word', 'abcdefghijklm', 'A word is 2 to 12 letters with no spaces.'],
    ['word', 'HI!', 'A word is 2 to 12 letters with no spaces.'],
    ['sentence', 'HELLO', 'A sentence has two to five words.'],
    ['sentence', 'one two three four five six', 'A sentence has two to five words.'],
    ['sentence', 'HI THERE!', 'A sentence has two to five words.'],
]);
