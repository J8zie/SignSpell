<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    // Lets the request through only if the user's role is one of the allowed roles.
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Please sign in to continue.'], 401);
        }

        if (! $user->isActive()) {
            return response()->json(['message' => 'This account has been deactivated.'], 403);
        }

        if ($user->role === 'super_admin' && in_array('admin', $roles, true)) {
            return $next($request);
        }

        if (! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'You do not have access to this.'], 403);
        }

        return $next($request);
    }
}
