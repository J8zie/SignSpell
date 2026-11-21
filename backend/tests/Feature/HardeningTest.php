<?php

use App\Models\Sign;
use App\Models\User;
use App\Services\ImageStore;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

/** Second-pass checks: security, safe deletes, caching, throttling and filter edge cases. */

function signIn(string $username, string $password = 'secret-pass-1'): string
{
    return test()->postJson('/api/auth/login', compact('username', 'password'))->assertOk()->json('token');
}

function userWithPassword(string $role = 'learner', string $password = 'secret-pass-1'): User
{
    return User::factory()->create(['role' => $role, 'password' => $password]);
}

// ---------- sessions and tokens ----------

it('rejects a token that is older than the configured days', function () {
    $user = userWithPassword();
    $token = signIn($user->username);
    $this->withToken($token)->getJson('/api/auth/me')->assertOk();

    $this->travel(config('signspell.token_days') + 1)->days();
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
});

it('signs other devices out when the password changes but keeps this one', function () {
    $user = userWithPassword();
    $phone = signIn($user->username);
    $laptop = signIn($user->username);

    $this->withToken($phone)->postJson('/api/profile/password', ['currentPassword' => 'secret-pass-1', 'newPassword' => 'another-pass-2'])->assertNoContent();

    $this->app['auth']->forgetGuards();
    $this->withToken($phone)->getJson('/api/auth/me')->assertOk();
    $this->app['auth']->forgetGuards();
    $this->withToken($laptop)->getJson('/api/auth/me')->assertUnauthorized();
});

it('rejects a wrong current password and a new password equal to the username', function () {
    $user = userWithPassword();
    Sanctum::actingAs($user);
    $this->postJson('/api/profile/password', ['currentPassword' => 'nope-nope-1', 'newPassword' => 'another-pass-2'])
        ->assertStatus(422)->assertJsonValidationErrors(['currentPassword']);
    $this->postJson('/api/profile/password', ['currentPassword' => 'secret-pass-1', 'newPassword' => $user->username.'x'])->assertNoContent();
    $this->postJson('/api/profile/password', ['currentPassword' => 'another-pass-2', 'newPassword' => 'short'])
        ->assertStatus(422)->assertJsonValidationErrors(['newPassword']);
});

it('signs a person out everywhere when an admin resets their password', function () {
    $target = userWithPassword();
    $token = signIn($target->username);
    Sanctum::actingAs(person('admin'));
    $this->putJson('/api/admin/accounts/'.$target->user_id, [
        'username' => $target->username, 'role' => 'learner', 'firstName' => 'A', 'lastName' => 'B',
        'email' => $target->info->email, 'password' => 'reset-pass-99',
    ])->assertOk();
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
});

it('logs in with any letter case and never says which part was wrong', function () {
    $user = userWithPassword('learner');
    $this->postJson('/api/auth/login', ['username' => strtoupper($user->username), 'password' => 'secret-pass-1'])->assertOk();
    $a = $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'wrong-pass-1'])->assertStatus(401);
    $b = $this->postJson('/api/auth/login', ['username' => 'nobody.here', 'password' => 'wrong-pass-1'])->assertStatus(401);
    expect($a->json('message'))->toBe('Wrong username or password.')->and($b->json())->toBe($a->json());
});

// ---------- throttling ----------

it('limits account creation per address', function () {
    config(['signspell.limits.register_per_minute' => 3]);
    foreach (range(1, 3) as $i) {
        $this->postJson('/api/auth/register', [
            'username' => 'bulk.user'.$i, 'password' => 'secret-pass-1', 'role' => 'learner',
            'firstName' => 'A', 'lastName' => 'B', 'email' => "bulk{$i}@example.org",
        ])->assertCreated();
    }
    $this->postJson('/api/auth/register', [
        'username' => 'bulk.user9', 'password' => 'secret-pass-1', 'role' => 'learner',
        'firstName' => 'A', 'lastName' => 'B', 'email' => 'bulk9@example.org',
    ])->assertStatus(429)->assertExactJson(['message' => 'Too many tries. Please wait a minute.']);
});

it('limits password guessing across many usernames from one address', function () {
    config(['signspell.limits.login_ip_per_minute' => 4]);
    foreach (range(1, 4) as $i) {
        $this->postJson('/api/auth/login', ['username' => 'guess'.$i, 'password' => 'whatever-1'])->assertStatus(401);
    }
    $this->postJson('/api/auth/login', ['username' => 'guess9', 'password' => 'whatever-1'])->assertStatus(429);
});

it('applies the general api limit with a friendly message', function () {
    config(['signspell.limits.api_per_minute' => 3]);
    Sanctum::actingAs(person());
    foreach (range(1, 3) as $i) {
        $this->getJson('/api/signs')->assertOk();
    }
    $this->getJson('/api/signs')->assertStatus(429)->assertExactJson(['message' => 'Too many tries. Please wait a minute.']);
});

// ---------- safe deletes ----------

it('still deletes a sign when the file storage is down', function () {
    Sanctum::actingAs(person('super_admin'));
    $id = $this->post('/api/signs', ['label' => 'DOG', 'signType' => 'word', 'image' => UploadedFile::fake()->image('d.jpg')])->assertCreated()->json('signId');
    app(ImageStore::class)->failDeletes = true;
    $this->deleteJson("/api/signs/{$id}?confirm=1")->assertNoContent();
    expect(Sign::find($id))->toBeNull();
});

it('still deletes an account when the file storage is down, and removes its tokens', function () {
    $victim = userWithPassword('learner');
    signIn($victim->username);
    expect($victim->tokens()->count())->toBe(1);
    $victim->info->forceFill(['profile_photo_public_id' => 'profiles/x', 'profile_photo_url' => 'https://x/y'])->save();

    Sanctum::actingAs(person('admin'));
    app(ImageStore::class)->failDeletes = true;
    $this->deleteJson('/api/admin/accounts/'.$victim->user_id.'?confirm=1')->assertNoContent();
    expect(User::find($victim->user_id))->toBeNull()
        ->and(\Laravel\Sanctum\PersonalAccessToken::where('tokenable_id', $victim->user_id)->count())->toBe(0);
});

it('keeps the old picture when a new upload fails, and removes it only after the save', function () {
    Sanctum::actingAs(person('super_admin'));
    $sign = $this->post('/api/signs', ['label' => 'B', 'signType' => 'letter', 'image' => UploadedFile::fake()->image('b.jpg')])->assertCreated()->json();
    $store = app(ImageStore::class);

    $store->uploads = 0; $store->failOnUpload = 1;
    $this->post("/api/signs/{$sign['signId']}", ['_method' => 'PUT', 'label' => 'B', 'signType' => 'letter', 'image' => UploadedFile::fake()->image('b2.jpg')])->assertStatus(500);
    expect(Sign::find($sign['signId'])->image_url)->toBe($sign['imageUrl'])->and($store->deleted)->toBe([]);

    $store->failOnUpload = 0;
    $res = $this->post("/api/signs/{$sign['signId']}", ['_method' => 'PUT', 'label' => 'B', 'signType' => 'letter', 'image' => UploadedFile::fake()->image('b3.jpg')])->assertOk();
    expect($res->json('imageUrl'))->not->toBe($sign['imageUrl'])->and($store->deleted)->toHaveCount(1);
});

it('keeps the picture when an edit sends no new one', function () {
    Sanctum::actingAs(person('super_admin'));
    $sign = $this->post('/api/signs', ['label' => 'C', 'signType' => 'letter', 'image' => UploadedFile::fake()->image('c.jpg')])->json();
    $this->post("/api/signs/{$sign['signId']}", ['_method' => 'PUT', 'label' => 'C', 'signType' => 'letter'])->assertOk()
        ->assertJsonPath('imageUrl', $sign['imageUrl']);
});

it('refuses to change a sign to a type its label does not fit', function () {
    Sanctum::actingAs(person('super_admin'));
    $sign = $this->post('/api/signs', ['label' => 'HELLO', 'signType' => 'word', 'image' => UploadedFile::fake()->image('h.jpg')])->json();
    $this->post("/api/signs/{$sign['signId']}", ['_method' => 'PUT', 'label' => 'HELLO', 'signType' => 'letter'])
        ->assertStatus(422)->assertJsonPath('errors.label.0', 'A letter sign has exactly one letter.');
});

// ---------- cache freshness ----------

it('shows a renamed owner at once in the cached sign list', function () {
    $teacher = person('teacher');
    sign($teacher, ['label' => 'KEY']);
    $learner = person();
    Sanctum::actingAs($learner);
    $before = $this->getJson('/api/signs')->json('0.ownerName');

    Sanctum::actingAs($teacher);
    $this->postJson('/api/profile', ['_method' => 'PUT', 'firstName' => 'Renamed', 'lastName' => 'Teacher', 'email' => $teacher->info->email])->assertOk();

    Sanctum::actingAs($learner);
    expect($this->getJson('/api/signs')->json('0.ownerName'))->toBe('Renamed Teacher')->not->toBe($before);
});

it('drops the owner name from cached signs when the teacher is deleted', function () {
    $teacher = person('teacher');
    sign($teacher, ['label' => 'KEY']);
    Sanctum::actingAs(person('super_admin'));
    expect($this->getJson('/api/signs')->json('0.ownerName'))->not->toBeNull();
    $this->deleteJson('/api/admin/accounts/'.$teacher->user_id.'?confirm=1')->assertNoContent();
    expect($this->getJson('/api/signs')->json('0.ownerName'))->toBeNull();
});

// ---------- list filters ----------

it('paginates signs and reports the total in a header', function () {
    foreach (['AA', 'BB', 'CC', 'DD', 'EE'] as $w) { sign(null, ['sign_type' => 'word', 'label' => $w]); }
    Sanctum::actingAs(person());
    $r = $this->getJson('/api/signs?type=word&sort=label&limit=2&page=2')->assertOk();
    expect(collect($r->json())->pluck('label')->all())->toBe(['CC', 'DD'])
        ->and($r->headers->get('X-Total-Count'))->toBe('5');
    expect($this->getJson('/api/signs')->headers->get('X-Total-Count'))->toBeNull();
});

it('treats % and _ as plain characters in a search', function () {
    sign(null, ['sign_type' => 'word', 'label' => 'HELLO']);
    Sanctum::actingAs(person());
    expect($this->getJson('/api/signs?q=%25')->json())->toBe([]);
    expect($this->getJson('/api/signs?q=_')->json())->toBe([]);
    expect($this->getJson('/api/signs?q=hel')->json())->toHaveCount(1);
});

it('puts an exact match first in a search', function () {
    sign(null, ['sign_type' => 'word', 'label' => 'CATS']);
    sign(null, ['sign_type' => 'word', 'label' => 'SCAT']);
    sign(null, ['sign_type' => 'word', 'label' => 'CAT']);
    Sanctum::actingAs(person());
    expect(collect($this->getJson('/api/signs?q=cat')->json())->pluck('label')->all())->toBe(['CAT', 'CATS', 'SCAT']);
});

it('validates the owner and sort filters', function () {
    $t = person('teacher');
    sign($t, ['label' => 'MINE1', 'sign_type' => 'word']);
    sign(null, ['label' => 'FREE1', 'sign_type' => 'word']);
    Sanctum::actingAs(person('admin'));
    $this->getJson('/api/signs?owner=not-a-uuid')->assertStatus(422)->assertJsonValidationErrors(['owner']);
    $this->getJson('/api/signs?sort=bogus')->assertStatus(422)->assertJsonValidationErrors(['sort']);
    expect($this->getJson('/api/signs?owner=none')->json())->toHaveCount(1);
    expect($this->getJson('/api/signs?owner='.$t->user_id)->json())->toHaveCount(1);
    expect($this->getJson('/api/signs?donated=1')->json())->toHaveCount(1);
    Sanctum::actingAs($t);
    expect($this->getJson('/api/signs?mine=1')->json())->toHaveCount(1);
});

it('answers 404 for an id that is not a uuid', function () {
    Sanctum::actingAs(person('admin'));
    $this->getJson('/api/signs/12345')->assertNotFound();
    $this->getJson('/api/admin/accounts/12345/impact')->assertNotFound();
    $this->getJson('/api/signs/12345/impact')->assertNotFound();
});

// ---------- errors never leak ----------

it('never leaks internals on an unexpected error', function () {
    config(['app.debug' => true]);
    Route::middleware('api')->get('/api/boom', fn () => throw new RuntimeException('secret table users_xyz'));
    $res = $this->getJson('/api/boom')->assertStatus(500);
    expect($res->json())->toHaveKey('message')->and(array_keys($res->json()))->toBe(['message']);
    expect($res->getContent())->not->toContain('users_xyz')->not->toContain('trace')->not->toContain('vendor');
});
