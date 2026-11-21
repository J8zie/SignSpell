<?php

namespace App\Models;

use Database\Factories\SignFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Sign extends Model
{
    /** @use HasFactory<SignFactory> */
    use HasFactory, HasUuids;

    public const UPDATED_AT = null;

    protected $primaryKey = 'sign_id';

    protected $fillable = [
        'sign_type',
        'label',
        'image_url',
        'image_public_id',
        'userownership_id',
        'source',
    ];

    // Gets the teacher who donated this sign (null if it belongs to SignSpell).
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userownership_id', 'user_id');
    }

    // Gets all pictures and the video attached to this sign.
    public function media(): HasMany
    {
        return $this->hasMany(SignMedia::class, 'sign_id', 'sign_id');
    }

    // Gets this sign's hint text, if one exists.
    public function hint(): HasOne
    {
        return $this->hasOne(SignHint::class, 'sign_id', 'sign_id');
    }

    // Gets every learner attempt recorded for this sign.
    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class, 'sign_id', 'sign_id');
    }

    // Gets every learner's mastery row for this sign.
    public function masteryRows(): HasMany
    {
        return $this->hasMany(Mastery::class, 'sign_id', 'sign_id');
    }

    // Gets every reference landmark sample recorded for this sign.
    public function samples(): HasMany
    {
        return $this->hasMany(SignSample::class, 'sign_id', 'sign_id');
    }

    // Gets the ordered word signs that make up this phrase (empty for letters/words).
    public function words(): HasMany
    {
        return $this->hasMany(SignWord::class, 'sign_id', 'sign_id')->orderBy('position');
    }

    // True when the user is an admin or the teacher who donated this sign.
    public function editableBy(User $user): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->role === 'teacher' && $this->userownership_id === $user->user_id;
    }
}
