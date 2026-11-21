<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignWord extends Model
{
    // The primary key is the (sign_id, position) pair, so there is no single id column.
    public $incrementing = false;
    public $timestamps = false;

    protected $primaryKey = 'sign_id';

    protected $fillable = [
        'sign_id',
        'word_sign_id',
        'position',
    ];

    protected $casts = [
        'position' => 'integer',
    ];

    // Gets the phrase this word belongs to.
    public function sign(): BelongsTo
    {
        return $this->belongsTo(Sign::class, 'sign_id', 'sign_id');
    }

    // Gets the word sign at this position.
    public function word(): BelongsTo
    {
        return $this->belongsTo(Sign::class, 'word_sign_id', 'sign_id');
    }
}
