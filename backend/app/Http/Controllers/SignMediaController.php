<?php

namespace App\Http\Controllers;

use App\Http\Requests\MediaRequest;
use App\Http\Resources\MediaResource;
use App\Models\Sign;
use App\Models\SignMedia;
use App\Services\Audit;
use App\Services\GeminiService;
use App\Services\ImageStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

class SignMediaController extends Controller
{
    // Returns a sign's pictures and video in display order.
    public function index(Sign $sign)
    {
        return MediaResource::collection($this->ordered($sign));
    }

    // Replaces a sign's whole media list with the newly uploaded files.
    public function store(MediaRequest $request, Sign $sign, ImageStore $images)
    {
        $this->authorizeEditor($request, $sign);

        $uploaded = [];   // files uploaded in this request (removed again if anything fails)
        $final = [];      // the rows the sign will have afterwards, in order
        $current = $sign->media()->get()->keyBy(fn ($m) => strtolower($m->media_id));
        $files = array_values($request->file('pictures', []));

        try {
            if ($request->keepsExisting()) {
                // The app says exactly what stays and what is new, so unchanged pictures are never uploaded again.
                foreach ((array) $request->input('order') as $token) {
                    [$kind, $value] = explode(':', (string) $token, 2);
                    if ($kind === 'keep') {
                        $row = $current[strtolower($value)];
                        $final[] = ['media_id' => $row->media_id, 'type' => 'image', 'url' => $row->url, 'public_id' => $row->public_id, 'name' => $row->name];
                    } else {
                        $picture = $files[(int) $value];
                        $stored = $images->upload($picture, 'sign-media');
                        $uploaded[] = ['public_id' => $stored['public_id'], 'type' => 'image'];
                        $final[] = ['type' => 'image', 'url' => $stored['url'], 'public_id' => $stored['public_id'], 'name' => $picture->getClientOriginalName()];
                    }
                }
                $keptVideo = $current->first(fn ($m) => $m->type === 'video');
                if (! $request->hasFile('video') && $request->boolean('keepVideo') && $keptVideo) {
                    $final[] = ['media_id' => $keptVideo->media_id, 'type' => 'video', 'url' => $keptVideo->url, 'public_id' => $keptVideo->public_id, 'name' => $keptVideo->name];
                }
            } else {
                foreach ($files as $picture) {
                    $stored = $images->upload($picture, 'sign-media');
                    $uploaded[] = ['public_id' => $stored['public_id'], 'type' => 'image'];
                    $final[] = ['type' => 'image', 'url' => $stored['url'], 'public_id' => $stored['public_id'], 'name' => $picture->getClientOriginalName()];
                }
            }

            if ($request->hasFile('video')) {
                $video = $request->file('video');
                $stored = $images->upload($video, 'sign-media');
                $uploaded[] = ['public_id' => $stored['public_id'], 'type' => 'video'];
                $final[] = ['type' => 'video', 'url' => $stored['url'], 'public_id' => $stored['public_id'], 'name' => $video->getClientOriginalName()];
            }

            // Old rows whose file is not part of the new list are removed from storage after the save succeeds.
            $keptIds = collect($final)->pluck('public_id')->all();
            $old = $current->filter(fn ($m) => ! in_array($m->public_id, $keptIds, true));

            DB::transaction(function () use ($sign, $final) {
                $sign->media()->delete();
                $sequence = 0;
                foreach ($final as $item) {
                    $row = new \App\Models\SignMedia(['type' => $item['type'], 'url' => $item['url'], 'public_id' => $item['public_id'], 'name' => $item['name']]);
                    $row->sign_id = $sign->sign_id;
                    $row->sequence = $item['type'] === 'image' ? ++$sequence : null;
                    if (isset($item['media_id'])) {
                        $row->media_id = $item['media_id'];   // a kept picture keeps its id
                    }
                    $row->save();
                }
            });
        } catch (Throwable $e) {
            foreach ($uploaded as $item) {
                try {
                    $images->delete($item['public_id'], $item['type'] === 'video' ? 'video' : 'image');
                } catch (Throwable) {
                }
            }

            throw $e;
        }

        foreach ($old as $media) {
            try {
                $images->delete($media->public_id, $media->type === 'video' ? 'video' : 'image');
            } catch (Throwable $e) {
                report($e);
            }
        }

        Audit::record($request->user(), Audit::MEDIA_UPDATE, $request, 'sign', $sign->sign_id, "Updated media on \"{$sign->label}\".", null, ['items' => count($final)]);

        return MediaResource::collection($this->ordered($sign));
    }

    // Removes all of a sign's pictures and video.
    public function destroy(Request $request, Sign $sign, ImageStore $images)
    {
        $this->authorizeEditor($request, $sign);
        $old = $sign->media()->get();
        $sign->media()->delete();
        Audit::record($request->user(), Audit::MEDIA_DELETE, $request, 'sign', $sign->sign_id, "Deleted all media on \"{$sign->label}\".", ['items' => $old->count()]);

        foreach ($old as $media) {
            try {
                $images->delete($media->public_id, $media->type === 'video' ? 'video' : 'image');
            } catch (Throwable $e) {
                report($e);
            }
        }

        return response()->noContent();
    }

    // Returns the sign's media with images first, then the video.
    private function ordered(Sign $sign)
    {
        return $sign->media()
            ->orderByRaw("case when type = 'video' then 1 else 0 end")
            ->orderBy('sequence')
            ->get();
    }

    // Sends the sign's video (or first picture) to Gemini and returns the ASL sign sequence it detects.
    public function analyze(Request $request, Sign $sign, GeminiService $gemini)
    {
        $this->authorizeEditor($request, $sign);

        // Prefer the video: it shows the whole sequence. Fall back to the first picture, then the sign's own image (letters).
        $media = $sign->media()->where('type', 'video')->first()
            ?? $sign->media()->where('type', 'image')->orderBy('sequence')->first();
        if (! $media && $sign->image_url) {
            $media = new SignMedia(['type' => 'image', 'url' => $sign->image_url, 'name' => $sign->label]);
        }
        abort_if(! $media, 422, 'This sign has no media to analyze yet.');

        $response = Http::timeout(120)->get($media->url);
        abort_unless($response->successful(), 502, 'Could not download the media for analysis.');
        $bytes = $response->body();
        abort_if($bytes === '', 502, 'The media file is empty.');

        $mime = $this->mimeOf($media);
        $result = $gemini->analyzeSignSequence($bytes, $mime);

        Audit::record($request->user(), Audit::MEDIA_ANALYZE, $request, 'sign', $sign->sign_id,
            "Analyzed media on \"{$sign->label}\" with Gemini.", null, ['labels' => $result['labels'], 'media' => $media->type]);

        return response()->json([
            'mediaType' => $media->type,
            'labels' => $result['labels'],
            'description' => $result['description'],
        ]);
    }

    // Guesses the mime type from the stored filename or URL extension.
    private function mimeOf(SignMedia $media): string
    {
        $ext = strtolower(pathinfo((string) parse_url($media->url, PHP_URL_PATH), PATHINFO_EXTENSION));
        return match ($ext) {
            'mp4', 'm4v' => 'video/mp4',
            'webm' => 'video/webm',
            'mov' => 'video/quicktime',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'jpg', 'jpeg' => 'image/jpeg',
            default => $media->type === 'video' ? 'video/mp4' : 'image/jpeg',
        };
    }

    // Stops users who are not allowed to edit this sign.
    private function authorizeEditor(Request $request, Sign $sign): void
    {
        if (! $sign->editableBy($request->user())) {
            abort(403, 'You do not have access to this.');
        }
    }
}
