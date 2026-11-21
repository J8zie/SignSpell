<?php

use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

/** "No N+1": a list costs the same number of queries for 3 rows or for 30. */

function queriesFor(string $url): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    test()->getJson($url)->assertOk();
    $n = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $n;
}

it('lists signs with a fixed number of queries', function () {
    $teachers = collect(range(1, 3))->map(fn () => person('teacher'));
    foreach (range(1, 3) as $i) { sign($teachers[$i % 3], ['sign_type' => 'word', 'label' => 'W'.chr(64 + $i).'X']); }
    Sanctum::actingAs(person());
    $small = queriesFor('/api/signs?type=word');

    foreach (range(4, 30) as $i) { sign($teachers[$i % 3], ['sign_type' => 'word', 'label' => 'W'.chr(64 + ($i % 26) + 1).chr(65 + intdiv($i, 26)).'Z']); }
    \Illuminate\Support\Facades\Cache::flush();
    $large = queriesFor('/api/signs?type=word&sort=label');

    expect($large)->toBe($small)->and($large)->toBeLessThanOrEqual(5);
});

it('lists accounts with a fixed number of queries', function () {
    foreach (range(1, 3) as $i) { person(); }
    Sanctum::actingAs(person('admin'));
    $small = queriesFor('/api/admin/accounts');
    foreach (range(1, 25) as $i) { person(); }
    expect(queriesFor('/api/admin/accounts'))->toBe($small)->and($small)->toBeLessThanOrEqual(5);
});

it('builds teacher progress with a fixed number of queries', function () {
    $t = person('teacher');
    $signs = collect(range(1, 3))->map(fn ($i) => sign($t, ['label' => 'S'.chr(64 + $i)]));
    foreach (range(1, 2) as $i) { attempt(person(), $signs[0]); }
    Sanctum::actingAs($t);
    $small = queriesFor('/api/teacher/learners-progress');

    foreach (range(1, 10) as $i) { $l = person(); foreach ($signs as $s) { attempt($l, $s); } }
    expect(queriesFor('/api/teacher/learners-progress'))->toBe($small)->and($small)->toBeLessThanOrEqual(8);
});

it('builds my attempts, mastery and summary with a fixed number of queries', function () {
    $me = person();
    $signs = collect(range(1, 3))->map(fn ($i) => sign(person('teacher'), ['label' => 'T'.chr(64 + $i)]));
    foreach ($signs as $s) { attempt($me, $s); }
    Sanctum::actingAs($me);
    $a = queriesFor('/api/me/attempts'); $m = queriesFor('/api/me/mastery'); $s1 = queriesFor('/api/me/summary');

    foreach (range(4, 20) as $i) { attempt($me, sign(person('teacher'), ['label' => 'T'.chr(64 + ($i % 26) + 1).'Q'])); }
    expect(queriesFor('/api/me/attempts'))->toBe($a)->and(queriesFor('/api/me/mastery'))->toBe($m)->and(queriesFor('/api/me/summary'))->toBe($s1);
});
