<?php

use Laravel\Sanctum\Sanctum;

it('returns only my attempts, newest first', function () {
    $me = person();
    $other = person();
    $s = sign();
    attempt($me, $s, true, '2026-03-01 10:00:00');
    attempt($me, $s, false, '2026-03-02 10:00:00');
    attempt($other, $s);
    Sanctum::actingAs($me);

    $res = $this->getJson('/api/me/attempts')->assertOk();
    expect($res->json())->toHaveCount(2)
        ->and($res->json('0.isCorrect'))->toBeFalse()
        ->and(collect($res->json())->pluck('learnersId')->unique()->all())->toBe([$me->user_id]);
});

it('filters attempts by sign, type, inclusive dates and limit', function () {
    $me = person();
    $letter = sign(null, ['sign_type' => 'letter', 'label' => 'Q']);
    $word = sign(null, ['sign_type' => 'word', 'label' => 'QUIZ']);
    attempt($me, $letter, true, '2026-03-01 08:00:00');
    attempt($me, $word, true, '2026-03-05 23:30:00');
    attempt($me, $word, true, '2026-03-09 09:00:00');
    Sanctum::actingAs($me);

    expect($this->getJson('/api/me/attempts?signId='.$letter->sign_id)->json())->toHaveCount(1);
    expect($this->getJson('/api/me/attempts?type=word')->json())->toHaveCount(2);
    expect($this->getJson('/api/me/attempts?from=2026-03-05&to=2026-03-05')->json())->toHaveCount(1);
    expect($this->getJson('/api/me/attempts?limit=1')->json())->toHaveCount(1);
    $this->getJson('/api/me/attempts?from=2026-03-09&to=2026-03-01')->assertStatus(422)
        ->assertJsonPath('errors.to.0', 'The end date cannot be before the start date.');
    $this->getJson('/api/me/attempts?limit=900')->assertStatus(422);
});

it('returns only my mastery', function () {
    $me = person();
    $other = person();
    $s = sign();
    attempt($me, $s);
    attempt($other, $s);
    Sanctum::actingAs($me);
    $rows = $this->getJson('/api/me/mastery')->assertOk()->json();
    expect($rows)->toHaveCount(1)->and($rows[0]['learnersId'])->toBe($me->user_id);
});

it('gives a summary with practice next and streak', function () {
    $me = person();
    $a = sign(null, ['sign_type' => 'letter', 'label' => 'A']);
    $b = sign(null, ['sign_type' => 'letter', 'label' => 'B']);
    attempt($me, $a, true, now()->toDateTimeString());
    attempt($me, $a, false, now()->subDay()->toDateTimeString());
    Sanctum::actingAs($me);

    $res = $this->getJson('/api/me/summary')->assertOk();
    exactKeys($res->json(), ['totalAttempts', 'accuracy', 'mastered', 'familiar', 'learning', 'newCount', 'streakDays', 'byType', 'practiceNext']);
    expect($res->json('totalAttempts'))->toBe(2)
        ->and($res->json('accuracy'))->toBe(0.5)
        ->and($res->json('streakDays'))->toBe(2)
        ->and($res->json('newCount'))->toBe(1)
        ->and($res->json('byType.letter'))->toBe(2)
        ->and($res->json('practiceNext.0.signId'))->toBe($b->sign_id);
});

it('has a streak of zero when the last practice was long ago', function () {
    $me = person();
    attempt($me, sign(), true, now()->subDays(5)->toDateTimeString());
    Sanctum::actingAs($me);
    $this->getJson('/api/me/summary')->assertJsonPath('streakDays', 0);
});

it('keeps these routes for learners only', function () {
    foreach (['/api/me/attempts', '/api/me/mastery', '/api/me/summary'] as $url) {
        $this->app['auth']->forgetGuards();
        $this->getJson($url)->assertUnauthorized();
        Sanctum::actingAs(person('teacher'));
        $this->getJson($url)->assertForbidden();
    }
});
