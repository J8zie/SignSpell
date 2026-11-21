<?php

use App\Models\SignMedia;
use App\Services\ImageStore;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

function pics(int $n): array
{
    return array_map(fn ($i) => UploadedFile::fake()->image("p{$i}.jpg"), range(1, $n));
}

it('replaces pictures and video in order with a single video', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $res = $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(3), 'video' => UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4')])->assertOk();
    $items = $res->json();
    expect($items)->toHaveCount(4)
        ->and(collect($items)->pluck('sequence')->all())->toBe([1, 2, 3, null])
        ->and(collect($items)->pluck('type')->all())->toBe(['image', 'image', 'image', 'video']);
    exactKeys($items[0], ['id', 'type', 'name', 'url', 'sequence']);

    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(1)])->assertOk();
    expect(SignMedia::where('sign_id', $s->sign_id)->count())->toBe(1);
    expect(app(ImageStore::class)->deleted)->toHaveCount(4);
    $this->getJson("/api/signs/{$s->sign_id}/media")->assertOk()->assertJsonCount(1);
});

it('changes nothing when one upload fails', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(2)])->assertOk();
    $before = SignMedia::pluck('public_id')->sort()->values()->all();

    app(ImageStore::class)->uploads = 0;
    app(ImageStore::class)->failOnUpload = 2;
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(3)])->assertStatus(500);
    expect(SignMedia::pluck('public_id')->sort()->values()->all())->toBe($before);
});

it('validates pictures and video', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $this->post("/api/signs/{$s->sign_id}/media", [])->assertStatus(422)->assertJsonPath('errors.pictures.0', 'Add at least one picture.');
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(13)])->assertStatus(422);
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => [UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')]])->assertStatus(422);
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(1), 'video' => UploadedFile::fake()->create('big.mp4', 26000, 'video/mp4')])->assertStatus(422)->assertJsonValidationErrors(['video']);
});

it('refuses another teacher and learners, and deletes media for the owner', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs(person('teacher'));
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(1)])->assertForbidden();
    Sanctum::actingAs(person());
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(1)])->assertForbidden();
    Sanctum::actingAs($t);
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(2)])->assertOk();
    $this->deleteJson("/api/signs/{$s->sign_id}/media")->assertNoContent();
    expect(SignMedia::count())->toBe(0);
});

// ---------- keeping saved pictures (the app sends the final order) ----------

function savedMedia(string $signId): array
{
    return SignMedia::where('sign_id', $signId)->orderByRaw("case when type='video' then 1 else 0 end")->orderBy('sequence')->get()->all();
}

it('keeps, reorders and adds pictures without uploading the saved ones again', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(3), 'video' => UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4')])->assertOk();
    [$p1, $p2, $p3, $video] = savedMedia($s->sign_id);
    $store = app(ImageStore::class);
    $uploadsBefore = $store->uploads;
    $store->deleted = [];

    $res = $this->post("/api/signs/{$s->sign_id}/media", [
        'order' => ["keep:{$p3->media_id}", "keep:{$p1->media_id}", 'new:0'],
        'pictures' => pics(1),
        'keepVideo' => '1',
    ])->assertOk();

    $items = $res->json();
    expect(collect($items)->pluck('type')->all())->toBe(['image', 'image', 'image', 'video'])
        ->and(collect($items)->pluck('sequence')->all())->toBe([1, 2, 3, null])
        ->and($items[0]['id'])->toBe($p3->media_id)->and($items[1]['id'])->toBe($p1->media_id)
        ->and($items[3]['id'])->toBe($video->media_id);
    expect($store->uploads - $uploadsBefore)->toBe(1);              // only the new picture travelled
    expect($store->deleted)->toBe([$p2->public_id]);                // only the dropped picture left storage
});

it('removes the video unless it is kept or replaced', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(1), 'video' => UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4')])->assertOk();
    [$p1, $video] = savedMedia($s->sign_id);

    $this->post("/api/signs/{$s->sign_id}/media", ['order' => ["keep:{$p1->media_id}"]])->assertOk()->assertJsonCount(1);
    expect(app(ImageStore::class)->deleted)->toContain($video->public_id);
});

it('rejects an order that points at something it should not', function () {
    $t = person('teacher'); $s = sign($t); $other = sign($t, ['label' => 'ZZ', 'sign_type' => 'word']);
    Sanctum::actingAs($t);
    $this->post("/api/signs/{$other->sign_id}/media", ['pictures' => pics(1)])->assertOk();
    $foreign = savedMedia($other->sign_id)[0];
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(1)])->assertOk();
    $mine = savedMedia($s->sign_id)[0];

    $this->post("/api/signs/{$s->sign_id}/media", ['order' => ["keep:{$foreign->media_id}"]])->assertStatus(422)->assertJsonValidationErrors(['order']);
    $this->post("/api/signs/{$s->sign_id}/media", ['order' => ["keep:{$mine->media_id}", "keep:{$mine->media_id}"]])->assertStatus(422);
    $this->post("/api/signs/{$s->sign_id}/media", ['order' => ["keep:{$mine->media_id}", 'new:0']])->assertStatus(422);             // no file for new:0
    $this->post("/api/signs/{$s->sign_id}/media", ['order' => ["keep:{$mine->media_id}"], 'pictures' => pics(1)])->assertStatus(422); // a file nobody asked for
    $this->post("/api/signs/{$s->sign_id}/media", ['order' => []])->assertStatus(422);
    $this->post("/api/signs/{$s->sign_id}/media", ['order' => ['whatever']])->assertStatus(422);
    expect(SignMedia::where('sign_id', $s->sign_id)->count())->toBe(1);   // nothing changed
});

it('changes nothing and removes new uploads when a kept-order save fails midway', function () {
    $t = person('teacher'); $s = sign($t);
    Sanctum::actingAs($t);
    $this->post("/api/signs/{$s->sign_id}/media", ['pictures' => pics(1)])->assertOk();
    $mine = savedMedia($s->sign_id)[0];
    $store = app(ImageStore::class);
    $store->uploads = 0; $store->failOnUpload = 2;
    $this->post("/api/signs/{$s->sign_id}/media", ['order' => ["keep:{$mine->media_id}", 'new:0', 'new:1'], 'pictures' => pics(2)])->assertStatus(500);
    expect(SignMedia::where('sign_id', $s->sign_id)->count())->toBe(1)->and(savedMedia($s->sign_id)[0]->media_id)->toBe($mine->media_id);
    expect($store->deleted)->toHaveCount(1);   // the one new picture that did upload was cleaned up
});
