<?php

use App\Models\Mastery;
use Laravel\Sanctum\Sanctum;

function body(array $o = []): array
{
    return array_merge(['predictedLabel' => 'a', 'confidence' => 0.9, 'isCorrect' => true], $o);
}

it('lets only a learner record an attempt', function () {
    $s = sign();
    $this->postJson('/api/attempts', body(['signId' => $s->sign_id]))->assertUnauthorized();
    foreach (['teacher', 'admin', 'super_admin'] as $role) {
        Sanctum::actingAs(person($role));
        $this->postJson('/api/attempts', body(['signId' => $s->sign_id]))->assertForbidden();
    }
});

it('creates mastery on the first attempt and updates it after', function () {
    $learner = person();
    $s = sign();
    Sanctum::actingAs($learner);

    $first = $this->postJson('/api/attempts', body(['signId' => $s->sign_id]))->assertCreated();
    expect($first->json('mastery.attemptsCount'))->toBe(1)
        ->and($first->json('mastery.masteryLevel'))->toBe('learning')
        ->and($first->json('attempt.predictedLabel'))->toBe('A');
    exactKeys($first->json('attempt'), ['attemptsId', 'learnersId', 'signId', 'predictedLabel', 'confidence', 'isCorrect', 'createdAt']);
    exactKeys($first->json('mastery'), ['masteryId', 'learnersId', 'signId', 'attemptsCount', 'correctAvg', 'masteryLevel', 'updatedAt']);

    $this->postJson('/api/attempts', body(['signId' => $s->sign_id, 'isCorrect' => false]))->assertCreated()
        ->assertJsonPath('mastery.attemptsCount', 2)
        ->assertJsonPath('mastery.correctAvg', 0.5);
    expect(Mastery::count())->toBe(1);
});

it('validates the attempt fields with friendly messages', function () {
    Sanctum::actingAs(person());
    $s = sign();
    $this->postJson('/api/attempts', body(['signId' => $s->sign_id, 'confidence' => 1.5]))
        ->assertStatus(422)->assertJsonPath('errors.confidence.0', 'Confidence must be between 0 and 1.');
    $this->postJson('/api/attempts', body(['signId' => $s->sign_id, 'isCorrect' => 'maybe']))
        ->assertStatus(422)->assertJsonValidationErrors(['isCorrect']);
    $this->postJson('/api/attempts', body(['signId' => $s->sign_id, 'predictedLabel' => str_repeat('A', 61)]))
        ->assertStatus(422)->assertJsonValidationErrors(['predictedLabel']);
    $this->postJson('/api/attempts', body(['signId' => '8f4e1c2a-0000-4000-8000-000000000000']))
        ->assertStatus(422)->assertJsonPath('errors.signId.0', 'We could not find that sign.');
    $this->postJson('/api/attempts', [])->assertStatus(422)
        ->assertJsonValidationErrors(['signId', 'predictedLabel', 'confidence', 'isCorrect']);
});

it('counts every attempt when several arrive in a row', function () {
    $learner = person();
    $s = sign();
    Sanctum::actingAs($learner);
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/attempts', body(['signId' => $s->sign_id]))->assertCreated();
    }
    $m = Mastery::first();
    expect($m->attempts_count)->toBe(5)->and($m->mastery_level)->toBe('mastered');
});

it('throttles attempts after the limit', function () {
    config(['signspell.limits.attempts_per_minute' => 3]);
    Sanctum::actingAs(person());
    $s = sign();
    foreach (range(1, 3) as $i) {
        $this->postJson('/api/attempts', body(['signId' => $s->sign_id]))->assertCreated();
    }
    $r = $this->postJson('/api/attempts', body(['signId' => $s->sign_id]));
    $r->assertStatus(429)
        ->assertJsonPath('message', 'Too many tries. Please wait a minute.');
});
