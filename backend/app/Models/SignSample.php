<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignSample extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $primaryKey = 'sample_id';

    protected $fillable = [
        'sign_id',
        'source',
        'signer_ref',
        'source_sequence_id',
        'landmarks',
        'frame_count',
    ];

    protected $casts = [
        'landmarks' => 'array',
        'frame_count' => 'integer',
    ];

    // Gets the sign this sample belongs to.
    public function sign(): BelongsTo
    {
        return $this->belongsTo(Sign::class, 'sign_id', 'sign_id');
    }
}
