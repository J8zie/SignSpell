<?php

use App\Models\User;

function registerPayload(array $overrides = []): array
{
    return array_merge([
        'username' => 'learner'.fake()->unique()->numerify('###'),
        'password' => 'password1',
        'role' => 'learner',
        'firstName' => 'Ada',
        'lastName' => 'Lee',
        'email' => fake()->unique()->safeEmail(),
    ], $overrides);
}

it('registers a learner and a teacher', function (string $role) {
    $payload = registerPayload(['role' => $role]);

    $response = $this->postJson('/api/auth/register', $payload);

    $response->assertCreated();
    exactKeys($response->json('account'), ['userId', 'username', 'role', 'status', 'info']);
    exactKeys($response->json('account.info'), [
        'userinfoId', 'userId', 'firstName', 'lastName', 'email', 'profilePhotoUrl', 'createdAt',
    ]);
    expect($response->json('account.role'))->toBe($role);
    expect($response->json('account.info.email'))->toBe(strtolower($payload['email']));
    expect($response->json('token'))->toBeString();
    expect($response->json('account'))->not->toHaveKey('password');
})->with(['learner', 'teacher']);

it('rejects registration as admin', function () {
    $this->postJson('/api/auth/register', registerPayload(['role' => 'admin']))
        ->assertStatus(422)
        ->assertJsonStructure(['message', 'errors' => ['role']]);
});

it('rejects a duplicate username and email on the matching fields', function () {
    $first = registerPayload(['username' => 'ada', 'email' => 'ada@example.com']);
    $this->postJson('/api/auth/register', $first)->assertCreated();

    $this->postJson('/api/auth/register', registerPayload([
        'username' => 'ADA',
        'email' => 'other@example.com',
    ]))->assertStatus(422)->assertJsonValidationErrors(['username']);

    $this->postJson('/api/auth/register', registerPayload([
        'username' => 'ada2',
        'email' => 'Ada@Example.com',
    ]))->assertStatus(422)->assertJsonValidationErrors(['email']);
});

it('logs in and rejects a wrong password with the same message', function () {
    $this->postJson('/api/auth/register', registerPayload([
        'username' => 'ada',
        'password' => 'password1',
    ]))->assertCreated();

    $this->postJson('/api/auth/login', [
        'username' => 'ADA',
        'password' => 'password1',
    ])->assertOk()->assertJsonStructure(['token', 'account']);

    $this->postJson('/api/auth/login', [
        'username' => 'missing',
        'password' => 'password1',
    ])->assertUnauthorized()->assertExactJson([
        'message' => 'Wrong username or password.',
    ]);

    $this->postJson('/api/auth/login', [
        'username' => 'ada',
        'password' => 'wrongpass',
    ])->assertUnauthorized()->assertExactJson([
        'message' => 'Wrong username or password.',
    ]);
});

it('throttles login after five tries', function () {
    User::factory()->create(['username' => 'ada', 'password' => 'password1']);

    foreach (range(1, 5) as $ignored) {
        $this->postJson('/api/auth/login', [
            'username' => 'ada',
            'password' => 'wrongpass',
        ])->assertUnauthorized();
    }

    $this->postJson('/api/auth/login', [
        'username' => 'ada',
        'password' => 'password1',
    ])->assertStatus(429)->assertExactJson([
        'message' => 'Too many tries. Please wait a minute.',
    ]);
});

it('returns the account and invalidates the token on logout', function () {
    $user = User::factory()->create();
    $token = $user->createToken('auth')->plainTextToken;

    $this->withToken($token)->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('userId', $user->user_id);

    $this->withToken($token)->postJson('/api/auth/logout')->assertNoContent();
    expect($user->tokens()->count())->toBe(0);
    // the test client keeps the signed-in user in memory between calls; a real next request starts fresh
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
});

it('requires a sign in for me', function () {
    $this->getJson('/api/auth/me')
        ->assertUnauthorized()
        ->assertJsonStructure(['message']);
});

it('creates a super admin from questions and refuses a second one', function () {
    $this->artisan('signspell:make-admin')
        ->expectsQuestion('First name', 'Ada')
        ->expectsQuestion('Last name', 'Lovelace')
        ->expectsQuestion('Email', 'Ada@Example.com')
        ->expectsQuestion('Username', 'ada')
        ->expectsQuestion('Password', 'password1')
        ->assertSuccessful();

    $admin = User::query()->where('role', 'super_admin')->first();
    expect($admin)->not->toBeNull();
    expect($admin->info->email)->toBe('ada@example.com');

    $this->artisan('signspell:make-admin')->assertFailed();

    expect(User::query()->where('role', 'super_admin')->count())->toBe(1);

    $this->artisan('signspell:make-admin --force')
        ->expectsQuestion('First name', 'Grace')
        ->expectsQuestion('Last name', 'Hopper')
        ->expectsQuestion('Email', 'grace@example.com')
        ->expectsQuestion('Username', 'grace')
        ->expectsQuestion('Password', 'password1')
        ->assertSuccessful();
});

it('asks again after a bad answer instead of making you start over, and gives up after three tries', function () {
    // Second round is valid: the weak password from the first round is explained, then everything is asked again.
    $this->artisan('signspell:make-admin')
        ->expectsQuestion('First name', 'Ada')->expectsQuestion('Last name', 'Lovelace')
        ->expectsQuestion('Email', 'ada@example.com')->expectsQuestion('Username', 'ada.l')
        ->expectsQuestion('Password', 'short')
        ->expectsOutputToContain('The password must be at least 8 characters.')
        ->expectsQuestion('First name', 'Ada')->expectsQuestion('Last name', 'Lovelace')
        ->expectsQuestion('Email', 'ada@example.com')->expectsQuestion('Username', 'ada.l')
        ->expectsQuestion('Password', 'a-long-password')
        ->assertSuccessful();
    expect(User::query()->where('username', 'ada.l')->exists())->toBeTrue();
});

it('stops after three bad rounds and creates nothing', function () {
    $cmd = $this->artisan('signspell:make-admin');
    foreach (range(1, 3) as $i) {
        $cmd->expectsQuestion('First name', 'Ada')->expectsQuestion('Last name', 'L')
            ->expectsQuestion('Email', 'not-an-email')->expectsQuestion('Username', 'ada.l')
            ->expectsQuestion('Password', 'a-long-password');
    }
    $cmd->assertFailed();
    expect(User::count())->toBe(0);
});
