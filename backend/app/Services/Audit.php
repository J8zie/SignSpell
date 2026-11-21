<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class Audit
{
    // Action names used across the app so filters stay consistent.
    public const LOGIN = 'auth.login';
    public const LOGIN_FAILED = 'auth.login_failed';
    public const LOGOUT = 'auth.logout';
    public const REGISTER = 'auth.register';
    public const PASSWORD_CHANGE = 'profile.password_change';
    public const PROFILE_UPDATE = 'profile.update';
    public const ACCOUNT_CREATE = 'account.create';
    public const ACCOUNT_UPDATE = 'account.update';
    public const ACCOUNT_DELETE = 'account.delete';
    public const SIGN_CREATE = 'sign.create';
    public const SIGN_UPDATE = 'sign.update';
    public const SIGN_DELETE = 'sign.delete';
    public const HINT_UPDATE = 'sign.hint_update';
    public const HINT_DELETE = 'sign.hint_delete';
    public const MEDIA_UPDATE = 'sign.media_update';
    public const MEDIA_DELETE = 'sign.media_delete';
    public const MEDIA_ANALYZE = 'sign.media_analyze';
    public const SAMPLE_ADD = 'sign.sample_add';

    /**
     * Appends one audit row. Never throws: logging must not break the real action.
     *
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public static function record(
        ?User $user,
        string $action,
        ?Request $request = null,
        ?string $resourceType = null,
        ?string $resourceId = null,
        ?string $description = null,
        ?array $old = null,
        ?array $new = null,
    ): void {
        try {
            AuditLog::query()->create([
                'user_id' => $user?->user_id,
                'username' => $user?->username,
                'user_role' => $user?->role,
                'action' => $action,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'description' => $description ? Str::limit($description, 500, '') : null,
                'old_values' => $old,
                'new_values' => $new,
                'ip_address' => $request?->ip(),
                'user_agent' => $request ? Str::limit((string) $request->userAgent(), 500, '') : null,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
