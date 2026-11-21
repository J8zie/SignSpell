<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserInfo extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $primaryKey = 'userinfo_id';

    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'email',
        'profile_photo_url',
        'profile_photo_public_id',
    ];

    // Gets the user this info record belongs to.
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
