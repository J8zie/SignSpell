<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mastery extends Model
{
    use HasUuids;

    public const CREATED_AT = null;

    protected $table = 'mastery';

    protected $primaryKey = 'mastery_id';

    protected $fillable = [
        'learners_id',
        'sign_id',
        'attempts_count',
        'correct_avg',
        'mastery_level',
    ];

    // Turns counts, averages, and dates into the right PHP types.
    protected function casts(): array
    {
        return [
            'attempts_count' => 'integer',
            'correct_avg' => 'float',
            'updated_at' => 'datetime',
        ];
    }

    // Gets the learner this mastery row belongs to.
    public function learner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'learners_id', 'user_id');
    }

    // Gets the sign this mastery row is for.
    public function sign(): BelongsTo
    {
        return $this->belongsTo(Sign::class, 'sign_id', 'sign_id');
    }
}
