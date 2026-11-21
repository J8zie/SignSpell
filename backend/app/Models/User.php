<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    protected $primaryKey = 'user_id';

    protected $fillable = [
        'username',
        'password',
        'role',
        'status',
    ];

    protected $hidden = [
        'password',
    ];

    /** Hashes the password whenever it is set. */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    // Gets the user's profile info record.
    public function info(): HasOne
    {
        return $this->hasOne(UserInfo::class, 'user_id', 'user_id');
    }

    // Gets all practice attempts this user made as a learner.
    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class, 'learners_id', 'user_id');
    }

    // Gets all signs this user donated as a teacher.
    public function ownedSigns(): HasMany
    {
        return $this->hasMany(Sign::class, 'userownership_id', 'user_id');
    }

    // True when the user's role is admin or super admin.
    public function isAdmin(): bool
    {
        return in_array($this->role, ['admin', 'super_admin'], true);
    }

    // True only for the Super Admin, the single role allowed to manage admins and audit logs.
    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    // True when the account is allowed to sign in and use the API.
    public function isActive(): bool
    {
        return ($this->status ?? 'active') === 'active';
    }

    // Creates a user and their info record together in one transaction.
    public static function createWithInfo(string $username, string $password, string $role, string $firstName, string $lastName, string $email): self
    {
        return DB::transaction(function () use ($username, $password, $role, $firstName, $lastName, $email) {
            $user = static::query()->create([
                'username' => $username,
                'password' => $password,
                'role' => $role,
            ]);

            $user->info()->create([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => mb_strtolower($email),
            ]);

            return $user->load('info');
        });
    }
}
