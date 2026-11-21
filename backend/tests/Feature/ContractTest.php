<?php

use Laravel\Sanctum\Sanctum;

/** These checks protect the Angular app: the exact camelCase keys and the error format it reads. */

it('returns the Account shape from register, login and me', function () {
    $r = $this->postJson('/api/auth/register', [
        'username' => 'contract.user', 'password' => 'secret-pass-1', 'role' => 'learner',
        'firstName' => 'Ada', 'lastName' => 'Lovelace', 'email' => 'contract@example.org',
    ])->assertCreated();
    exactKeys($r->json(), ['token', 'account']);
    exactKeys($r->json('account'), ['userId', 'username', 'role', 'status', 'info']);
    exactKeys($r->json('account.info'), ['userinfoId', 'userId', 'firstName', 'lastName', 'email', 'profilePhotoUrl', 'createdAt']);
    expect($r->json('account'))->not->toHaveKey('password');

    $login = $this->postJson('/api/auth/login', ['username' => 'contract.user', 'password' => 'secret-pass-1'])->assertOk();
    exactKeys($login->json(), ['token', 'account']);

    $this->withToken($login->json('token'))->getJson('/api/auth/me')->assertOk();
});

it('returns the shapes of signs, hints, media, impact and progress', function () {
    $teacher = person('teacher'); $s = sign($teacher);
    $learner = person(); attempt($learner, $s);

    Sanctum::actingAs($learner);
    $list = $this->getJson('/api/signs')->assertOk()->json();
    exactKeys($list[0], ['signId', 'signType', 'imageUrl', 'label', 'createdAt', 'userOwnershipId', 'ownerName']);
    exactKeys($this->getJson('/api/signs/'.$s->sign_id)->json(), ['signId', 'signType', 'imageUrl', 'label', 'createdAt', 'userOwnershipId', 'ownerName']);
    exactKeys($this->getJson('/api/me/mastery')->json(0), ['masteryId', 'learnersId', 'signId', 'attemptsCount', 'correctAvg', 'masteryLevel', 'updatedAt']);
    exactKeys($this->getJson('/api/me/attempts')->json(0), ['attemptsId', 'learnersId', 'signId', 'predictedLabel', 'confidence', 'isCorrect', 'createdAt']);

    Sanctum::actingAs(person('admin'));
    exactKeys($this->getJson("/api/signs/{$s->sign_id}/impact")->json(), ['attempts', 'learners', 'media']);
});

it('uses the 422 format with message and errors under the frontend field names', function () {
    $r = $this->postJson('/api/auth/register', ['username' => 'x'])->assertStatus(422);
    exactKeys($r->json(), ['message', 'errors']);
    expect($r->json('errors'))->toHaveKeys(['username', 'password', 'role', 'firstName', 'lastName', 'email']);
    expect($r->json('message'))->toBe($r->json('errors.username.0'));
});

it('uses a plain message for other errors and never leaks internals', function () {
    $this->getJson('/api/signs/not-a-real-id')->assertUnauthorized()->assertExactJson(['message' => 'Please sign in to continue.']);
    Sanctum::actingAs(person());
    $r = $this->getJson('/api/signs/8f4e1c2a-0000-4000-8000-000000000000')->assertNotFound();
    expect($r->json())->toBe(['message' => 'We could not find that.']);
    $this->getJson('/api/no-such-route')->assertNotFound()->assertExactJson(['message' => 'We could not find that.']);
    $this->getJson('/api/admin/accounts')->assertForbidden()->assertExactJson(['message' => 'You do not have access to this.']);
});
