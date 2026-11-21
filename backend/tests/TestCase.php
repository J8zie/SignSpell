<?php

namespace Tests;

use App\Services\ImageStore;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Tests\Fakes\FakeImageStore;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->instance(ImageStore::class, new FakeImageStore());
        Cache::flush();
    }
}
