<?php

use Laravel\Sanctum\Sanctum;

it('shows only learners on signs this teacher owns', function () {
    $t1 = person('teacher');
    $t2 = person('teacher');
    $mine = sign($t1, ['label' => 'MINE']);
    $theirs = sign($t2, ['label' => 'THEIRS']);
    $ada = person();
    $bob = person();
    attempt($ada, $mine);
    attempt($bob, $theirs);
    Sanctum::actingAs($t1);

    $rows = $this->getJson('/api/teacher/learners-progress')->assertOk()->json();
    expect($rows)->toHaveCount(1)->and($rows[0]['signLabel'])->toBe('MINE')->and($rows[0]['learnerId'])->toBe($ada->user_id);
    exactKeys($rows[0], ['learnerId', 'learnerName', 'signId', 'signLabel', 'signType', 'attemptsCount', 'correctAvg', 'masteryLevel', 'lastAttemptAt']);
});

it('refuses a sign id that belongs to another teacher', function () {
    $t1 = person('teacher');
    $foreign = sign(person('teacher'));
    attempt(person(), $foreign);
    Sanctum::actingAs($t1);
    $this->getJson('/api/teacher/learners-progress?signId='.$foreign->sign_id)->assertForbidden();
});

it('groups per learner and sign and computes the level', function () {
    $t = person('teacher');
    $s = sign($t);
    $l = person();
    foreach (range(1, 5) as $i) { attempt($l, $s, true); }
    Sanctum::actingAs($t);
    $row = $this->getJson('/api/teacher/learners-progress')->json(0);
    expect($row['attemptsCount'])->toBe(5)->and($row['correctAvg'])->toBe(1)->and($row['masteryLevel'])->toBe('mastered');
});

it('filters by dates, learner and mastery level', function () {
    $t = person('teacher');
    $s = sign($t);
    $a = person();
    $b = person();
    attempt($a, $s, true, '2026-02-01 10:00:00');
    attempt($b, $s, false, '2026-02-10 10:00:00');
    Sanctum::actingAs($t);

    expect($this->getJson('/api/teacher/learners-progress?from=2026-02-05')->json())->toHaveCount(1);
    expect($this->getJson('/api/teacher/learners-progress?to=2026-02-01')->json())->toHaveCount(1);
    expect($this->getJson('/api/teacher/learners-progress?learner='.$a->user_id)->json())->toHaveCount(1);
    expect($this->getJson('/api/teacher/learners-progress?mastery=learning')->json())->toHaveCount(2);
    expect($this->getJson('/api/teacher/learners-progress?mastery=mastered')->json())->toHaveCount(0);
    $this->getJson('/api/teacher/learners-progress?from=2026-02-10&to=2026-02-01')->assertStatus(422);
});

it('exports a csv that excel can open', function () {
    $t = person('teacher');
    $s = sign($t, ['label' => 'HELLO']);
    attempt(person(), $s);
    Sanctum::actingAs($t);
    $res = $this->get('/api/teacher/learners-progress/export')->assertOk();
    $csv = $res->streamedContent();
    expect(str_starts_with($csv, "\xEF\xBB\xBF"))->toBeTrue()
        ->and($csv)->toContain('Learner,Sign,Type,Attempts,"Correct %",Level,"Last practiced"')
        ->and($csv)->toContain('HELLO');
});

it('gives a summary of this teacher only', function () {
    $t = person('teacher');
    $s = sign($t);
    attempt(person(), $s, true);
    attempt(person(), $s, false);
    attempt(person(), sign(person('teacher')));
    Sanctum::actingAs($t);
    $res = $this->getJson('/api/teacher/summary')->assertOk();
    exactKeys($res->json(), ['learners', 'attempts', 'accuracy', 'signsDonated', 'lastActivityAt']);
    expect($res->json('learners'))->toBe(2)->and($res->json('attempts'))->toBe(2)->and($res->json('signsDonated'))->toBe(1);
});

it('is for teachers only', function () {
    $this->getJson('/api/teacher/learners-progress')->assertUnauthorized();
    foreach (['learner', 'admin'] as $role) {
        Sanctum::actingAs(person($role));
        $this->getJson('/api/teacher/learners-progress')->assertForbidden();
    }
});
