<?php

use App\Models\Sign;
use App\Models\User;
use App\Services\MasteryService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('maps counts and averages to levels', function () {
    $service = app(MasteryService::class);

    expect($service->levelFor(0, 0))->toBe('new');
    expect($service->levelFor(3, 0.6))->toBe('familiar');
    expect($service->levelFor(5, 0.85))->toBe('mastered');
    expect($service->levelFor(5, 0.84))->toBe('familiar');
    expect($service->levelFor(2, 1))->toBe('learning');
});

it('updates the running average across attempts', function () {
    $service = app(MasteryService::class);
    $learner = User::factory()->create();
    $sign = Sign::factory()->create(['sign_type' => 'letter', 'label' => 'A']);

    $first = $service->recordAttempt($learner, $sign, 'a', 0.9, true);
    $second = $service->recordAttempt($learner, $sign, 'b', 0.4, false);
    $third = $service->recordAttempt($learner, $sign, 'a', 0.95, true);

    expect($first['mastery']->attempts_count)->toBe(1);
    expect($first['mastery']->mastery_level)->toBe('learning');
    expect($second['mastery']->correct_avg)->toEqualWithDelta(0.5, 0.0001);
    expect($third['mastery']->attempts_count)->toBe(3);
    expect($third['mastery']->correct_avg)->toEqualWithDelta(2 / 3, 0.0001);
    expect($third['mastery']->mastery_level)->toBe('familiar');
});

it('reaches mastered after five strong attempts', function () {
    $service = app(MasteryService::class);
    $learner = User::factory()->create();
    $sign = Sign::factory()->create(['sign_type' => 'letter', 'label' => 'B']);
    $last = null;

    foreach (range(1, 5) as $ignored) {
        $last = $service->recordAttempt($learner, $sign, 'b', 0.99, true);
    }

    expect($last['mastery']->attempts_count)->toBe(5);
    expect($last['mastery']->correct_avg)->toEqualWithDelta(1, 0.0001);
    expect($last['mastery']->mastery_level)->toBe('mastered');
});

it('keeps the average exact so a level never slips because of rounding', function () {
    $learner = person();
    $s = sign();
    // 17 correct out of 20 is exactly 0.85; mixing the wrong ones in early creates repeating decimals on the way.
    $pattern = [false, true, true, false, true, true, true, false, true, true, true, true, true, true, true, true, true, true, true, true];
    foreach ($pattern as $ok) {
        $result = app(\App\Services\MasteryService::class)->recordAttempt($learner, $s, 'A', 0.9, $ok);
    }
    expect((float) $result['mastery']->correct_avg)->toBe(0.85)
        ->and($result['mastery']->mastery_level)->toBe('mastered');
});

it('survives two first attempts arriving at the same moment', function () {
    $learner = person();
    $s = sign();
    // The first save loses the race: the database reports a duplicate mastery row, exactly as it would
    // when another request created it a moment earlier. The service must retry and keep the attempt.
    $lost = false;
    \App\Models\Mastery::creating(function () use (&$lost) {
        if (! $lost) {
            $lost = true;
            throw new \Illuminate\Database\UniqueConstraintViolationException('testing', 'insert into mastery', [], new \Exception('duplicate'));
        }
    });
    $result = app(\App\Services\MasteryService::class)->recordAttempt($learner, $s, 'A', 0.9, true);

    expect($lost)->toBeTrue()
        ->and($result['mastery']->attempts_count)->toBe(1)
        ->and(\App\Models\Mastery::count())->toBe(1)
        ->and(\App\Models\Attempt::count())->toBe(1);
});
