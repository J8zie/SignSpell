<?php

namespace App\Http\Controllers;

use App\Http\Requests\AttemptRequest;
use App\Http\Resources\AttemptResource;
use App\Http\Resources\MasteryResource;
use App\Models\Sign;
use App\Services\MasteryService;

class AttemptController extends Controller
{
    // Saves one practice attempt and returns the updated mastery score.
    public function store(AttemptRequest $request, MasteryService $mastery)
    {
        $sign = Sign::query()->findOrFail($request->string('signId')->toString());
        $result = $mastery->recordAttempt(
            $request->user(),
            $sign,
            $request->string('predictedLabel')->toString(),
            (float) $request->input('confidence'),
            $request->boolean('isCorrect'),
        );

        return response()->json([
            'attempt' => (new AttemptResource($result['attempt']))->resolve($request),
            'mastery' => (new MasteryResource($result['mastery']))->resolve($request),
        ], 201);
    }
}
