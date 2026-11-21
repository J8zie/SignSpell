<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

it('updates the name and email', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->post('/api/profile', [
        '_method' => 'PUT',
        'firstName' => ' Ada ',
        'lastName' => 'Lovelace',
        'email' => 'Ada@Example.com',
    ])->assertOk()
        ->assertJsonPath('info.firstName', 'Ada')
        ->assertJsonPath('info.email', 'ada@example.com');
});

it('rejects a duplicate email', function () {
    User::factory()->create();
    $other = User::factory()->create();
    $taken = User::query()->where('user_id', '!=', $other->user_id)->first()->info->email;
    Sanctum::actingAs($other);

    $this->post('/api/profile', [
        '_method' => 'PUT',
        'firstName' => 'Grace',
        'lastName' => 'Hopper',
        'email' => $taken,
    ])->assertStatus(422)->assertJsonValidationErrors(['email']);
});

it('rejects a bad photo type and an oversized photo', function () {
    Sanctum::actingAs(User::factory()->create());

    $this->post('/api/profile', [
        '_method' => 'PUT',
        'firstName' => 'Ada',
        'lastName' => 'Lee',
        'email' => 'ada@example.com',
        'photo' => UploadedFile::fake()->create('face.gif', 20, 'image/gif'),
    ])->assertStatus(422)->assertJsonValidationErrors(['photo']);

    $this->post('/api/profile', [
        '_method' => 'PUT',
        'firstName' => 'Ada',
        'lastName' => 'Lee',
        'email' => 'ada@example.com',
        'photo' => UploadedFile::fake()->image('face.jpg')->size(config('signspell.image.max_kb') + 1),
    ])->assertStatus(422)->assertJsonValidationErrors(['photo']);
});

it('stores an accepted photo', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->post('/api/profile', [
        '_method' => 'PUT',
        'firstName' => 'Ada',
        'lastName' => 'Lee',
        'email' => 'ada@example.com',
        'photo' => UploadedFile::fake()->image('face.jpg'),
    ])->assertOk()
        ->assertJsonPath('info.profilePhotoUrl', fn ($url) => str_contains((string) $url, 'f_auto,q_auto,w_800'));
});

it('requires the current password to change it', function () {
    $user = User::factory()->create(['username' => 'ada', 'password' => 'password1']);
    Sanctum::actingAs($user);

    $this->postJson('/api/profile/password', [
        'currentPassword' => 'wrongpass',
        'newPassword' => 'newpassword',
    ])->assertStatus(422)->assertJsonValidationErrors(['currentPassword']);

    $this->postJson('/api/profile/password', [
        'currentPassword' => 'password1',
        'newPassword' => 'newpassword',
    ])->assertNoContent();

    $this->postJson('/api/auth/login', [
        'username' => 'ada',
        'password' => 'newpassword',
    ])->assertOk();
});
