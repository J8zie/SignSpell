<?php

use Laravel\Sanctum\Sanctum;

/** A person in Davao (UTC+8) practices at 7am local time, which is 23:00 the day before in UTC. */

it('filters my attempts by days in my own time zone', function () {
    $me = person();
    $s = sign();
    attempt($me, $s, true, '2026-03-05 23:00:00'); // 2026-03-06 07:00 in Manila
    Sanctum::actingAs($me);

    expect($this->getJson('/api/me/attempts?from=2026-03-06&to=2026-03-06')->json())->toHaveCount(0);   // UTC day: not on the 6th
    expect($this->getJson('/api/me/attempts?from=2026-03-06&to=2026-03-06&tz=Asia/Manila')->json())->toHaveCount(1);
    expect($this->getJson('/api/me/attempts?from=2026-03-05&to=2026-03-05&tz=Asia/Manila')->json())->toHaveCount(0);
    $this->getJson('/api/me/attempts?tz=Mars/Base')->assertStatus(422)->assertJsonPath('errors.tz.0', 'Choose a valid time zone.');
});

it('counts the streak by days in my own time zone', function () {
    $me = person();
    $s = sign();
    // Local days (Manila): today 07:00 and yesterday 07:00. In UTC those are 23:00 of the two days before them.
    $todayLocal = now('Asia/Manila')->startOfDay()->addHours(7)->setTimezone('UTC')->toDateTimeString();
    $yesterdayLocal = now('Asia/Manila')->startOfDay()->subDay()->addHours(7)->setTimezone('UTC')->toDateTimeString();
    attempt($me, $s, true, $todayLocal);
    attempt($me, $s, true, $yesterdayLocal);
    Sanctum::actingAs($me);
    $this->getJson('/api/me/summary?tz=Asia/Manila')->assertOk()->assertJsonPath('streakDays', 2);
    $this->getJson('/api/me/summary?tz=Nowhere/Land')->assertStatus(422);
});

it('filters teacher progress by days in the teacher zone', function () {
    $t = person('teacher');
    $s = sign($t);
    attempt(person(), $s, true, '2026-03-05 23:00:00');
    Sanctum::actingAs($t);
    expect($this->getJson('/api/teacher/learners-progress?from=2026-03-06')->json())->toHaveCount(0);
    expect($this->getJson('/api/teacher/learners-progress?from=2026-03-06&tz=Asia/Manila')->json())->toHaveCount(1);
    $this->getJson('/api/teacher/learners-progress?tz=bad')->assertStatus(422);
});

it('counts attempts today in the admin zone', function () {
    $s = sign();
    $startManila = now('Asia/Manila')->startOfDay()->setTimezone('UTC');
    attempt(person(), $s, true, $startManila->copy()->addMinute()->toDateTimeString());
    attempt(person(), $s, true, $startManila->copy()->subMinute()->toDateTimeString());
    Sanctum::actingAs(person('admin'));
    $this->getJson('/api/admin/summary?tz=Asia/Manila')->assertOk()->assertJsonPath('attemptsToday', 1);
});
