<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attempt extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $primaryKey = 'attempts_id';

    protected $fillable = [
        'learners_id',
        'sign_id',
        'predicted_label',
        'confidence',
        'is_correct',
        'created_at',
    ];

    // Turns confidence, is_correct, and created_at into the right PHP types.
    protected function casts(): array
    {
        return [
            'confidence' => 'float',
            'is_correct' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    // Gets the learner who made this attempt.
    public function learner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'learners_id', 'user_id');
    }

    // Gets the sign this attempt was for.
    public function sign(): BelongsTo
    {
        return $this->belongsTo(Sign::class, 'sign_id', 'sign_id');
    }
}
