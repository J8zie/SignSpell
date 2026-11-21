<?php

use App\Models\SignHint;
use Laravel\Sanctum\Sanctum;

it('lets the owner teacher save, read and delete a hint', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => 'Keep your thumb across your palm.'])->assertOk()->assertJsonPath('text', 'Keep your thumb across your palm.');
    $this->getJson("/api/signs/{$s->sign_id}/hint")->assertOk()->assertExactJson(['text' => 'Keep your thumb across your palm.']);
    $this->deleteJson("/api/signs/{$s->sign_id}/hint")->assertNoContent();
    $this->getJson("/api/signs/{$s->sign_id}/hint")->assertNotFound();
});

it('refuses another teacher, a learner and an admin, and allows a super admin', function () {
    $s = sign(person('teacher'));
    Sanctum::actingAs(person('teacher'));
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => 'x'])->assertForbidden();
    $this->deleteJson("/api/signs/{$s->sign_id}/hint")->assertForbidden();
    Sanctum::actingAs(person('learner'));
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => 'x'])->assertForbidden();
    Sanctum::actingAs(person('admin'));
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => 'ok'])->assertForbidden();
    Sanctum::actingAs(person('super_admin'));
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => 'ok'])->assertOk();
});

it('limits a hint to 200 characters and deletes it when blank', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => str_repeat('a', 201)])->assertStatus(422)->assertJsonValidationErrors(['text']);
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => str_repeat('a', 200)])->assertOk();
    $this->putJson("/api/signs/{$s->sign_id}/hint", ['text' => '   '])->assertNoContent();
    expect(SignHint::count())->toBe(0);
});

it('returns every hint in one call for any signed in person', function () {
    $a = sign(); $b = sign();
    SignHint::create(['sign_id' => $a->sign_id, 'text' => 'one']);
    SignHint::create(['sign_id' => $b->sign_id, 'text' => 'two']);
    $this->getJson('/api/signs/hints')->assertUnauthorized();
    $this->app['auth']->forgetGuards();
    Sanctum::actingAs(person());
    $this->getJson('/api/signs/hints')->assertOk()->assertExactJson([$a->sign_id => 'one', $b->sign_id => 'two']);
});
