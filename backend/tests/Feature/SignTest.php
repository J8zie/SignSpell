<?php

use App\Models\Attempt;
use App\Models\Sign;
use App\Models\SignHint;
use App\Models\SignMedia;
use App\Models\User;
use App\Services\ImageStore;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\Fakes\FakeImageStore;

function signFields(array $overrides = []): array
{
    return array_merge([
        'label' => 'HELLO',
        'signType' => 'word',
        'image' => UploadedFile::fake()->image('hello.jpg'),
    ], $overrides);
}

it('forces a teacher to own the sign they create', function () {
    $teacher = User::factory()->create(['role' => 'teacher']);
    $other = User::factory()->create(['role' => 'teacher']);
    Sanctum::actingAs($teacher);

    $response = $this->post('/api/signs', signFields(['ownerId' => $other->user_id]));

    $response->assertCreated();
    expect($response->json('userOwnershipId'))->toBe($teacher->user_id);
    expect($response->json('label'))->toBe('HELLO');
    expect($response->json('ownerName'))->toBe($teacher->info->first_name.' '.$teacher->info->last_name);
    exactKeys($response->json(), [
        'signId', 'signType', 'imageUrl', 'label', 'createdAt', 'userOwnershipId', 'ownerName',
    ]);
});

it('lets a super admin assign a teacher and rejects a learner owner', function () {
    $admin = User::factory()->create(['role' => 'super_admin']);
    $teacher = User::factory()->create(['role' => 'teacher']);
    $learner = User::factory()->create(['role' => 'learner']);
    Sanctum::actingAs($admin);

    $this->post('/api/signs', signFields([
        'label' => 'CAT',
        'ownerId' => $teacher->user_id,
    ]))->assertCreated()->assertJsonPath('userOwnershipId', $teacher->user_id);

    $this->post('/api/signs', signFields([
        'label' => 'DOG',
        'ownerId' => $learner->user_id,
    ]))->assertStatus(422)->assertJsonValidationErrors(['ownerId']);
});

it('checks label rules and stores the uppercase form', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'teacher']));

    $this->post('/api/signs', signFields(['label' => 'AB', 'signType' => 'letter']))
        ->assertStatus(422)
        ->assertJsonPath('errors.label.0', 'A letter sign has exactly one letter.');

    $this->post('/api/signs', signFields(['label' => 'hi there', 'signType' => 'word']))
        ->assertStatus(422)
        ->assertJsonPath('errors.label.0', 'A word is 2 to 12 letters with no spaces.');

    $this->post('/api/signs', signFields(['label' => 'Onlyone', 'signType' => 'sentence']))
        ->assertStatus(422)
        ->assertJsonPath('errors.label.0', 'A sentence has two to five words.');

    $this->post('/api/signs', signFields(['label' => 'hello']))
        ->assertCreated()
        ->assertJsonPath('label', 'HELLO');
});

it('rejects a duplicate label in the same type and allows it in another type', function () {
    $teacher = User::factory()->create(['role' => 'teacher']);
    Sanctum::actingAs($teacher);

    $this->post('/api/signs', signFields(['label' => 'HI']))->assertCreated();
    $this->post('/api/signs', signFields(['label' => 'hi']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['label']);

    Sign::factory()->create(['sign_type' => 'letter', 'label' => 'HI']);

    $this->post('/api/signs', signFields(['label' => 'CAT']))->assertCreated();
    expect(Sign::query()->where('label', 'HI')->count())->toBe(2);
});

it('requires an image and rejects a non image', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'teacher']));

    $this->post('/api/signs', [
        'label' => 'SUN',
        'signType' => 'word',
    ])->assertStatus(422)->assertJsonValidationErrors(['image']);

    $this->post('/api/signs', signFields([
        'label' => 'SUN',
        'image' => UploadedFile::fake()->create('sun.gif', 20, 'image/gif'),
    ]))->assertStatus(422)->assertJsonValidationErrors(['image']);
});

it('lets only a super admin update or delete and requires confirmation', function () {
    $teacher = User::factory()->create(['role' => 'teacher']);
    $admin = User::factory()->create(['role' => 'super_admin']);
    $sign = Sign::factory()->create(['label' => 'MOON', 'sign_type' => 'word', 'userownership_id' => $teacher->user_id]);

    Sanctum::actingAs($teacher);
    $this->put('/api/signs/'.$sign->sign_id, [
        'label' => 'STAR',
        'signType' => 'word',
    ])->assertForbidden();
    $this->delete('/api/signs/'.$sign->sign_id.'?confirm=1')->assertForbidden();

    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
    $this->put('/api/signs/'.$sign->sign_id, ['label' => 'STAR', 'signType' => 'word'])->assertForbidden();
    $this->delete('/api/signs/'.$sign->sign_id.'?confirm=1')->assertForbidden();

    Sanctum::actingAs($admin);
    $this->delete('/api/signs/'.$sign->sign_id)
        ->assertStatus(422)
        ->assertJsonPath('message', 'Please confirm this action first.');

    $this->put('/api/signs/'.$sign->sign_id, [
        'label' => 'star',
        'signType' => 'word',
    ])->assertOk()->assertJsonPath('label', 'STAR');

    $this->delete('/api/signs/'.$sign->sign_id.'?confirm=1')->assertNoContent();
    expect(Sign::query()->find($sign->sign_id))->toBeNull();
});

it('cascades attempts media and hints when a sign is deleted', function () {
    $admin = User::factory()->create(['role' => 'super_admin']);
    $learner = User::factory()->create();
    $sign = Sign::factory()->create(['image_public_id' => 'signs/old']);
    SignMedia::query()->create([
        'sign_id' => $sign->sign_id,
        'type' => 'image',
        'sequence' => 1,
        'url' => 'https://example.test/1.jpg',
        'public_id' => 'sign-media/one',
        'name' => 'one.jpg',
    ]);
    SignHint::query()->create(['sign_id' => $sign->sign_id, 'text' => 'Wave.']);
    Attempt::query()->create([
        'learners_id' => $learner->user_id,
        'sign_id' => $sign->sign_id,
        'predicted_label' => 'A',
        'confidence' => 0.9,
        'is_correct' => true,
    ]);

    $fake = app(ImageStore::class);
    Sanctum::actingAs($admin);
    $this->delete('/api/signs/'.$sign->sign_id.'?confirm=1')->assertNoContent();

    expect(Attempt::query()->count())->toBe(0);
    expect(SignMedia::query()->count())->toBe(0);
    expect(SignHint::query()->count())->toBe(0);
    expect($fake)->toBeInstanceOf(FakeImageStore::class);
    expect($fake->deleted)->toContain('signs/old', 'sign-media/one');
});

it('filters signs by search type mine donated and sort', function () {
    $teacher = User::factory()->create(['role' => 'teacher']);
    $letter = Sign::factory()->create([
        'sign_type' => 'letter',
        'label' => 'A',
        'userownership_id' => null,
        'created_at' => now()->subDay(),
    ]);
    $mine = Sign::factory()->create([
        'sign_type' => 'word',
        'label' => 'HELLO',
        'userownership_id' => $teacher->user_id,
    ]);
    Sign::factory()->create([
        'sign_type' => 'word',
        'label' => 'HELP',
        'userownership_id' => $teacher->user_id,
    ]);

    Sanctum::actingAs($teacher);

    $search = $this->getJson('/api/signs?q=hel')->assertOk()->json();
    expect(collect($search)->pluck('label')->sort()->values()->all())->toBe(['HELLO', 'HELP']);

    Sign::factory()->create(['sign_type' => 'word', 'label' => 'APPLE', 'userownership_id' => null]);
    Sign::factory()->create(['sign_type' => 'word', 'label' => 'PINEAPPLE', 'userownership_id' => null]);
    Sign::factory()->create(['sign_type' => 'word', 'label' => 'APP', 'userownership_id' => null]);
    $ranked = collect($this->getJson('/api/signs?q=app&type=word')->json())->pluck('label')->take(3)->all();
    expect($ranked)->toBe(['APP', 'APPLE', 'PINEAPPLE']);

    $this->getJson('/api/signs?type=letter')->assertOk()->assertJsonPath('0.signId', $letter->sign_id);
    $this->getJson('/api/signs?mine=1')->assertOk()->assertJsonCount(2);
    $this->getJson('/api/signs?donated=1')->assertOk()->assertJsonCount(2);
    $this->getJson('/api/signs?type=letter&sort=label')->assertOk()->assertJsonPath('0.label', 'A');

    $this->put('/api/signs/'.$mine->sign_id, [
        'label' => 'HOWDY',
        'signType' => 'word',
    ]);

    Sanctum::actingAs(User::factory()->create(['role' => 'super_admin']));
    $this->put('/api/signs/'.$mine->sign_id, [
        'label' => 'HOWDY',
        'signType' => 'word',
    ])->assertOk();

    $labels = collect($this->getJson('/api/signs?q=howdy')->json())->pluck('label');
    expect($labels)->toContain('HOWDY');
});
