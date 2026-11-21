<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignMedia extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'sign_media';

    protected $primaryKey = 'media_id';

    protected $fillable = [
        'sign_id',
        'type',
        'sequence',
        'url',
        'public_id',
        'name',
    ];

    // Turns the sequence number into an integer.
    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
        ];
    }

    // Gets the sign this media file belongs to.
    public function sign(): BelongsTo
    {
        return $this->belongsTo(Sign::class, 'sign_id', 'sign_id');
    }
}
