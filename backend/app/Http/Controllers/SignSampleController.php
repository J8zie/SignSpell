<?php

namespace App\Http\Controllers;

use App\Models\Sign;
use App\Models\SignSample;
use App\Services\Audit;
use Illuminate\Http\Request;

class SignSampleController extends Controller
{
    // Lists a sign's landmark samples without the heavy landmarks payload.
    public function index(Request $request, Sign $sign)
    {
        $this->authorizeEditor($request, $sign);

        return $sign->samples()
            ->get(['sample_id', 'sign_id', 'source', 'signer_ref', 'source_sequence_id', 'frame_count', 'created_at'])
            ->map(fn ($s) => [
                'sampleId' => $s->sample_id,
                'source' => $s->source,
                'signerRef' => $s->signer_ref,
                'sourceSequenceId' => $s->source_sequence_id,
                'frameCount' => $s->frame_count,
                'createdAt' => $s->created_at?->toIso8601String(),
            ]);
    }

    // Stores one landmark sequence extracted on the uploader's device; landmarks are frames of 21 or 42 {x,y,z} points.
    public function store(Request $request, Sign $sign)
    {
        $this->authorizeEditor($request, $sign);

        $data = validator($request->all(), [
            'source' => ['required', 'string', 'max:100'],
            'source_sequence_id' => ['nullable', 'string', 'max:191'],
            'signer_ref' => ['nullable', 'string', 'max:191'],
            'frame_count' => ['nullable', 'integer', 'min:1', 'max:2000'],
            'landmarks' => ['required', 'array', 'min:1', 'max:2000'],
            'landmarks.*' => ['required', 'array'],
            'landmarks.*.*' => ['array'],
            'landmarks.*.*.*' => ['numeric'],
        ])->validate();

        $frames = $data['landmarks'];
        foreach ($frames as $i => $frame) {
            $points = count($frame);
            if (! in_array($points, [21, 42], true)) {
                abort(422, "Frame {$i} has {$points} points; expected 21 (one hand) or 42 (two hands).");
            }
            foreach ($frame as $p => $point) {
                if (! isset($point['x'], $point['y'], $point['z']) || ! is_numeric($point['x']) || ! is_numeric($point['y']) || ! is_numeric($point['z'])) {
                    abort(422, "Frame {$i} point {$p} is not an {x,y,z} landmark.");
                }
            }
        }

        $sample = SignSample::updateOrCreate(
            ['source' => $data['source'], 'source_sequence_id' => $data['source_sequence_id'] ?? null],
            [
                'sign_id' => $sign->sign_id,
                'signer_ref' => $data['signer_ref'] ?? null,
                'landmarks' => $frames,
                'frame_count' => $data['frame_count'] ?? count($frames),
            ],
        );

        Audit::record($request->user(), Audit::SAMPLE_ADD, $request, 'sign', $sign->sign_id,
            "Saved landmark sample on \"{$sign->label}\" ({$sample->frame_count} frames).",
            null, ['source' => $data['source'], 'frames' => $sample->frame_count]);

        return response()->json([
            'sampleId' => $sample->sample_id,
            'frameCount' => $sample->frame_count,
        ], 201);
    }

    // Stops users who are not allowed to edit this sign.
    private function authorizeEditor(Request $request, Sign $sign): void
    {
        if (! $sign->editableBy($request->user())) {
            abort(403, 'You do not have access to this.');
        }
    }
}
