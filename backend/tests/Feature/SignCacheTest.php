<?php

use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

it('shows a new sign at once even though the list is cached', function () {
    $admin = person('super_admin');
    Sanctum::actingAs($admin);
    expect($this->getJson('/api/signs')->json())->toHaveCount(0);

    $id = $this->post('/api/signs', ['label' => 'CAT', 'signType' => 'word', 'image' => UploadedFile::fake()->image('c.jpg')])->assertCreated()->json('signId');
    expect($this->getJson('/api/signs')->json())->toHaveCount(1);

    $this->deleteJson("/api/signs/{$id}?confirm=1")->assertNoContent();
    expect($this->getJson('/api/signs')->json())->toHaveCount(0);
});
