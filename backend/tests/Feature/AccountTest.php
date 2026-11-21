<?php

use App\Models\Attempt;
use App\Models\Sign;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

function acct(array $o = []): array
{
    static $n = 0;
    $n++;

    return array_merge([
        'username' => 'person'.$n, 'password' => 'secret-pass-1', 'role' => 'learner',
        'firstName' => 'Ada', 'lastName' => 'Lovelace', 'email' => "ada{$n}@example.org",
    ], $o);
}

it('lets an admin list only learners and teachers, and a super admin list everyone', function () {
    $admin = person('admin'); $super = person('super_admin');
    person('learner'); person('teacher');
    Sanctum::actingAs($admin);
    $roles = collect($this->getJson('/api/admin/accounts')->assertOk()->json())->pluck('role')->unique()->sort()->values()->all();
    expect($roles)->toBe(['learner', 'teacher']);
    expect($this->getJson('/api/admin/accounts?role=admin')->json())->toBe([]);
    Sanctum::actingAs($super);
    expect(collect($this->getJson('/api/admin/accounts')->json())->pluck('role')->unique()->all())->toContain('admin', 'super_admin');
});

it('searches name, username and email, and filters by role', function () {
    Sanctum::actingAs(person('admin'));
    $this->postJson('/api/admin/accounts', acct(['username' => 'zed.one', 'firstName' => 'Zed', 'email' => 'zed@example.org']))->assertCreated();
    $this->postJson('/api/admin/accounts', acct(['role' => 'teacher', 'firstName' => 'Mia']))->assertCreated();
    expect($this->getJson('/api/admin/accounts?q=ZED')->json())->toHaveCount(1);
    expect($this->getJson('/api/admin/accounts?q=example.org')->json())->not->toBeEmpty();
    expect($this->getJson('/api/admin/accounts?role=teacher')->json())->toHaveCount(1);
});

it('creates an account with the right shape and validates the fields', function () {
    Sanctum::actingAs(person('admin'));
    $r = $this->postJson('/api/admin/accounts', acct(['email' => 'New@Example.org']))->assertCreated();
    exactKeys($r->json(), ['userId', 'username', 'role', 'status', 'info']);
    exactKeys($r->json('info'), ['userinfoId', 'userId', 'firstName', 'lastName', 'email', 'profilePhotoUrl', 'createdAt']);
    expect($r->json('info.email'))->toBe('new@example.org');
    expect(User::where('username', $r->json('username'))->first()->password)->not->toBe('secret-pass-1');

    $this->postJson('/api/admin/accounts', acct(['username' => $r->json('username')]))->assertStatus(422)->assertJsonValidationErrors(['username']);
    $this->postJson('/api/admin/accounts', acct(['email' => 'new@example.org']))->assertStatus(422)->assertJsonValidationErrors(['email']);
    $this->postJson('/api/admin/accounts', acct(['password' => 'short']))->assertStatus(422)->assertJsonValidationErrors(['password']);
    $this->postJson('/api/admin/accounts', acct(['username' => 'a b']))->assertStatus(422)->assertJsonValidationErrors(['username']);
    $this->postJson('/api/admin/accounts', acct(['role' => 'wizard']))->assertStatus(422)->assertJsonValidationErrors(['role']);
});

it('stops an admin from touching admins, but lets a super admin', function () {
    $admin = person('admin'); $other = person('admin'); $super = person('super_admin');
    Sanctum::actingAs($admin);
    $this->postJson('/api/admin/accounts', acct(['role' => 'admin']))->assertForbidden();
    $this->postJson('/api/admin/accounts', acct(['role' => 'super_admin']))->assertForbidden();
    $payload = acct(['username' => $other->username, 'role' => 'admin', 'email' => $other->info->email]);
    $this->putJson('/api/admin/accounts/'.$other->user_id, $payload)->assertForbidden();
    $this->deleteJson('/api/admin/accounts/'.$other->user_id.'?confirm=1')->assertForbidden();
    $this->getJson('/api/admin/accounts/'.$other->user_id.'/impact')->assertForbidden();
    // promoting a learner to admin is also blocked
    $learner = person();
    $this->putJson('/api/admin/accounts/'.$learner->user_id, acct(['username' => $learner->username, 'role' => 'admin', 'email' => $learner->info->email]))->assertForbidden();

    Sanctum::actingAs($super);
    $this->postJson('/api/admin/accounts', acct(['role' => 'admin']))->assertCreated();
    $this->deleteJson('/api/admin/accounts/'.$other->user_id.'?confirm=1')->assertNoContent();
});

it('keeps the old password when it is left blank on update', function () {
    Sanctum::actingAs(person('admin'));
    $u = person();
    $hash = $u->password;
    $this->putJson('/api/admin/accounts/'.$u->user_id, acct(['username' => $u->username, 'email' => $u->info->email, 'password' => '', 'firstName' => 'Grace']))
        ->assertOk()->assertJsonPath('info.firstName', 'Grace');
    expect($u->fresh()->password)->toBe($hash);
    $this->putJson('/api/admin/accounts/'.$u->user_id, acct(['username' => $u->username, 'email' => $u->info->email, 'password' => 'brand-new-pass']))->assertOk();
    expect($u->fresh()->password)->not->toBe($hash);
});

it('will not delete yourself or the last super admin', function () {
    $super = person('super_admin');
    Sanctum::actingAs($super);
    $this->deleteJson('/api/admin/accounts/'.$super->user_id.'?confirm=1')->assertStatus(409)
        ->assertJsonPath('message', 'You cannot delete your own account.');
    $this->putJson('/api/admin/accounts/'.$super->user_id, acct(['username' => $super->username, 'email' => $super->info->email, 'role' => 'admin']))
        ->assertStatus(409)->assertJsonPath('message', 'There must be at least one Super Admin.');

    $second = person('super_admin');
    $this->deleteJson('/api/admin/accounts/'.$second->user_id.'?confirm=1')->assertNoContent();
});

it('needs confirm=1 to delete, shows the impact, and cascades', function () {
    Sanctum::actingAs(person('admin'));
    $teacher = person('teacher');
    $learner = person();
    $s = sign($teacher);
    attempt($learner, $s); attempt($learner, $s);
    $this->getJson('/api/admin/accounts/'.$learner->user_id.'/impact')->assertOk()->assertExactJson(['attempts' => 2, 'signsDonated' => 0]);
    $this->getJson('/api/admin/accounts/'.$teacher->user_id.'/impact')->assertExactJson(['attempts' => 0, 'signsDonated' => 1]);

    $this->deleteJson('/api/admin/accounts/'.$learner->user_id)->assertStatus(422)->assertJsonPath('message', 'Please confirm this action first.');
    $this->deleteJson('/api/admin/accounts/'.$learner->user_id.'?confirm=1')->assertNoContent();
    expect(Attempt::count())->toBe(0)->and(User::find($learner->user_id))->toBeNull();

    $this->deleteJson('/api/admin/accounts/'.$teacher->user_id.'?confirm=1')->assertNoContent();
    expect(Sign::find($s->sign_id))->not->toBeNull()->and(Sign::find($s->sign_id)->userownership_id)->toBeNull();
});

it('is for admins only and has a summary', function () {
    $this->getJson('/api/admin/accounts')->assertUnauthorized();
    foreach (['learner', 'teacher'] as $role) {
        Sanctum::actingAs(person($role));
        $this->getJson('/api/admin/accounts')->assertForbidden();
        $this->getJson('/api/admin/summary')->assertForbidden();
    }
    Sanctum::actingAs(person('admin'));
    exactKeys($this->getJson('/api/admin/summary')->assertOk()->json(), ['learners', 'teachers', 'admins', 'signs', 'donatedSigns', 'attemptsToday']);
});
