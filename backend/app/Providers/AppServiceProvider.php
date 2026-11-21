<?php

namespace App\Providers;

use App\Services\CloudinaryImageStore;
use App\Services\ImageStore;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    // Wires the ImageStore interface to the Cloudinary implementation.
    public function register(): void
    {
        $this->app->bind(ImageStore::class, CloudinaryImageStore::class);
    }

    // Sets token lifetime, unwraps JSON resources, and defines the rate limits.
    public function boot(): void
    {
        JsonResource::withoutWrapping();

        config([
            'sanctum.expiration' => (int) config('signspell.token_days') * 24 * 60,
        ]);

        $tooMany = fn () => response()->json(['message' => 'Too many tries. Please wait a minute.'], 429);

        RateLimiter::for('api', function (Request $request) use ($tooMany) {
            return Limit::perMinute((int) config('signspell.limits.api_per_minute'))
                ->by($request->user()?->getAuthIdentifier() ?: $request->ip())
                ->response($tooMany);
        });

        // Stops one address from creating accounts in bulk, or guessing passwords across many usernames.
        RateLimiter::for('register', fn (Request $request) => Limit::perMinute((int) config('signspell.limits.register_per_minute'))
            ->by($request->ip())->response($tooMany));
        RateLimiter::for('login-ip', fn (Request $request) => Limit::perMinute((int) config('signspell.limits.login_ip_per_minute'))
            ->by($request->ip())->response($tooMany));

        RateLimiter::for('attempts', function (Request $request) {
            return Limit::perMinute((int) config('signspell.limits.attempts_per_minute'))
                ->by($request->user()?->getAuthIdentifier() ?: $request->ip())
                ->response(fn () => response()->json([
                    'message' => 'Too many tries. Please wait a minute.',
                ], 429));
        });
    }
}
