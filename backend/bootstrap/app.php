<?php

use App\Http\Middleware\RoleMiddleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => RoleMiddleware::class,
        ]);

        // The 'api' limiter (defined in AppServiceProvider) now really applies to every API route.
        $middleware->throttleApi('api');

        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (\Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            // A response that was already built on purpose (for example the friendly 429 from the rate limiter).
            if ($e instanceof HttpResponseException) {
                return $e->getResponse();
            }

            if ($e instanceof ValidationException) {
                $errors = $e->errors();
                $first = collect($errors)->flatten()->first() ?: 'Please check the form and try again.';

                return response()->json([
                    'message' => $first,
                    'errors' => $errors,
                ], 422);
            }

            if ($e instanceof AuthenticationException) {
                return response()->json(['message' => 'Please sign in to continue.'], 401);
            }

            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $message = trim($e->getMessage());
                $fallback = [
                    401 => 'Please sign in to continue.',
                    403 => 'You do not have access to this.',
                    404 => 'We could not find that.',
                    409 => 'That action conflicts with another record.',
                    429 => 'Too many tries. Please wait a minute.',
                    503 => 'Image storage is not configured. Add your Cloudinary credentials and try again.',
                ];
                $unsafe = $message === ''
                    || str_contains($message, 'SQLSTATE')
                    || str_contains($message, 'could not be found')
                    || str_contains($message, 'No query results')
                    || str_starts_with($message, 'The route')
                    || in_array($message, [
                        'Unauthenticated.',
                        'This action is unauthorized.',
                        'Forbidden',
                        'Too Many Attempts.',
                        'Server Error',
                    ], true);

                if ($status === 429 || $unsafe) {
                    $message = $fallback[$status] ?? 'Something went wrong. Please try again.';
                }

                if ($status >= 500 && $unsafe) {
                    report($e);
                }

                return response()->json(['message' => $message], $status);
            }

            report($e);

            return response()->json(['message' => 'Something went wrong. Please try again.'], 500);
        });
    })->create();
