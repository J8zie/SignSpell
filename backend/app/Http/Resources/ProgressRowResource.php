<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProgressRowResource extends JsonResource
{
    // Shapes one learner-by-sign progress row into the JSON the app expects.
    public function toArray(Request $request): array
    {
        return [
            'learnerId' => $this->resource['learnerId'],
            'learnerName' => $this->resource['learnerName'],
            'signId' => $this->resource['signId'],
            'signLabel' => $this->resource['signLabel'],
            'signType' => $this->resource['signType'],
            'attemptsCount' => $this->resource['attemptsCount'],
            'correctAvg' => $this->resource['correctAvg'],
            'masteryLevel' => $this->resource['masteryLevel'],
            'lastAttemptAt' => $this->resource['lastAttemptAt'],
        ];
    }
}
