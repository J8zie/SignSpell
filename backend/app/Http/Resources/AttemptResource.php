<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttemptResource extends JsonResource
{
    // Shapes an attempt record into the camelCase JSON the app expects.
    public function toArray(Request $request): array
    {
        return [
            'attemptsId' => $this->attempts_id,
            'learnersId' => $this->learners_id,
            'signId' => $this->sign_id,
            'predictedLabel' => $this->predicted_label,
            'confidence' => (float) $this->confidence,
            'isCorrect' => (bool) $this->is_correct,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
