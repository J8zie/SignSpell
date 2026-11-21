<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MasteryResource extends JsonResource
{
    // Shapes a mastery record into the camelCase JSON the app expects.
    public function toArray(Request $request): array
    {
        return [
            'masteryId' => $this->mastery_id,
            'learnersId' => $this->learners_id,
            'signId' => $this->sign_id,
            'attemptsCount' => (int) $this->attempts_count,
            'correctAvg' => (float) $this->correct_avg,
            'masteryLevel' => $this->mastery_level,
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
