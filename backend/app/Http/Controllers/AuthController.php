<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\AccountResource;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // Creates an account and hands back a login token.
    public function register(RegisterRequest $request)
    {
        try {
            $user = User::createWithInfo(
                $request->string('username')->toString(),
                $request->string('password')->toString(),
                $request->string('role')->toString(),
                $request->string('firstName')->toString(),
                $request->string('lastName')->toString(),
                $request->string('email')->toString(),
            );
        } catch (UniqueConstraintViolationException $e) {
            throw ValidationException::withMessages(
                str_contains(strtolower($e->getMessage()), 'email')
                    ? ['email' => 'That email is already registered.']
                    : ['username' => 'That username is already taken.']
            );
        }

        Audit::record($user, Audit::REGISTER, $request, 'user', $user->user_id, 'New account registered.');

        return response()->json([
            'token' => $user->createToken('auth')->plainTextToken,
            'account' => (new AccountResource($user))->resolve($request),
        ], 201);
    }

    // Checks username and password (with rate limiting) and returns a token.
    public function login(LoginRequest $request)
    {
        $key = Str::lower($request->string('username')->toString()).'|'.$request->ip();
        $max = (int) config('signspell.limits.login_per_minute');

        if (RateLimiter::tooManyAttempts($key, $max)) {
            return response()->json(['message' => 'Too many tries. Please wait a minute.'], 429);
        }

        $user = User::query()
            ->whereRaw('lower(username) = ?', [Str::lower($request->string('username')->toString())])
            ->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            RateLimiter::hit($key, 60);
            Audit::record($user, Audit::LOGIN_FAILED, $request, 'user', $user?->user_id, 'Failed login attempt.');

            return response()->json(['message' => 'Wrong username or password.'], 401);
        }

        if (! $user->isActive()) {
            Audit::record($user, Audit::LOGIN_FAILED, $request, 'user', $user->user_id, 'Login blocked: account deactivated.');

            return response()->json(['message' => 'This account has been deactivated.'], 403);
        }

        RateLimiter::clear($key);
        Audit::record($user, Audit::LOGIN, $request, 'user', $user->user_id, 'Signed in.');

        return response()->json([
            'token' => $user->createToken('auth')->plainTextToken,
            'account' => (new AccountResource($user->load('info')))->resolve($request),
        ]);
    }

    // Deletes the current access token to log the user out.
    public function logout(Request $request)
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();
        if ($token && method_exists($token, 'delete')) {
            $token->delete();
        }

        Audit::record($user, Audit::LOGOUT, $request, 'user', $user?->user_id, 'Signed out.');

        return response()->noContent();
    }

    // Returns the logged-in user's account info.
    public function me(Request $request)
    {
        return new AccountResource($request->user()->load('info'));
    }
}
