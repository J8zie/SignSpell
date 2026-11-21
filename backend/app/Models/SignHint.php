<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignHint extends Model
{
    public const CREATED_AT = null;

    protected $primaryKey = 'sign_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'sign_id',
        'text',
    ];

    // Gets the sign this hint belongs to.
    public function sign(): BelongsTo
    {
        return $this->belongsTo(Sign::class, 'sign_id', 'sign_id');
    }
}
