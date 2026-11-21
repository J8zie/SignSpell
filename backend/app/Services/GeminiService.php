<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiService
{
    private const API = 'https://generativelanguage.googleapis.com';

    // Asks Gemini which ASL signs the media shows, in order; returns ['labels' => string[], 'description' => string].
    public function analyzeSignSequence(string $bytes, string $mimeType): array
    {
        $key = config('services.gemini.api_key');
        if (! $key) {
            throw new RuntimeException('Gemini is not configured (GEMINI_API_KEY).');
        }
        $model = config('services.gemini.model');

        $uri = str_starts_with($mimeType, 'video/')
            ? $this->uploadVideo($bytes, $mimeType, $key)
            : $this->inlineData($bytes, $mimeType);

        $prompt = 'This media shows American Sign Language (ASL) being signed. '
            .'Identify each distinct sign in the order it is performed. '
            .'Reply with ONLY a JSON object, no markdown: {"signs": ["SIGN_ONE", "SIGN_TWO"], "description": "one short sentence"}. '
            .'Use uppercase letters and spaces between words of a sign. If a hand gesture is unclear, give your best guess.';

        $response = Http::timeout(120)->post(self::API."/v1beta/models/{$model}:generateContent?key={$key}", [
            'contents' => [[
                'parts' => [
                    ['text' => $prompt],
                    $uri,
                ],
            ]],
            'generationConfig' => ['temperature' => 0.2, 'responseMimeType' => 'application/json'],
        ]);

        if ($response->failed()) {
            throw new RuntimeException('Gemini request failed: '.$response->status().' '.$response->body());
        }

        $text = $response->json('candidates.0.content.parts.0.text', '');
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new RuntimeException('Gemini returned an unreadable answer.');
        }

        $labels = array_values(array_filter(array_map(
            fn ($s) => strtoupper(trim((string) $s)),
            (array) ($data['signs'] ?? []),
        )));

        return ['labels' => $labels, 'description' => (string) ($data['description'] ?? '')];
    }

    // Wraps small media (images) as inline base64 for a single generateContent call.
    private function inlineData(string $bytes, string $mimeType): array
    {
        return ['inline_data' => ['mime_type' => $mimeType, 'data' => base64_encode($bytes)]];
    }

    // Uploads a video through the Files API (videos cannot be sent inline), waits until it is ACTIVE, and returns its file_data part.
    private function uploadVideo(string $bytes, string $mimeType, string $key): array
    {
        $start = Http::timeout(60)->withHeaders([
            'X-Goog-Upload-Protocol' => 'resumable',
            'X-Goog-Upload-Command' => 'start',
            'X-Goog-Upload-Header-Content-Length' => (string) strlen($bytes),
            'X-Goog-Upload-Header-Content-Type' => $mimeType,
            'Content-Type' => 'application/json',
        ])->post(self::API.'/upload/v1beta/files?key='.$key, [
            'file' => ['display_name' => 'sign-upload.'.$this->extension($mimeType)],
        ]);

        $uploadUrl = $start->header('X-Goog-Upload-URL');
        if (! $uploadUrl) {
            throw new RuntimeException('Gemini did not return an upload URL.');
        }

        // The finalize POST answers with the new file resource; poll it until Gemini finishes processing.
        $upload = Http::timeout(300)->withHeaders([
            'Content-Length' => (string) strlen($bytes),
            'X-Goog-Upload-Offset' => '0',
            'X-Goog-Upload-Command' => 'upload, finalize',
        ])->withBody($bytes, $mimeType)->post($uploadUrl);

        $name = $upload->json('file.name') ?? $upload->json('name');
        if (! $name) {
            throw new RuntimeException('Gemini did not accept the video upload.');
        }
        for ($i = 0; $i < 30; $i++) {
            $state = Http::timeout(30)->get(self::API.'/v1beta/'.$name.'?key='.$key)->json('state');
            if ($state === 'ACTIVE') {
                break;
            }
            if ($state === 'FAILED') {
                throw new RuntimeException('Gemini could not process the video.');
            }
            sleep(2);
        }

        return ['file_data' => ['mime_type' => $mimeType, 'file_uri' => 'https://generativelanguage.googleapis.com/v1beta/'.$name]];
    }

    // Maps a mime type to a file extension for the upload display name.
    private function extension(string $mimeType): string
    {
        return match (true) {
            str_contains($mimeType, 'mp4') => 'mp4',
            str_contains($mimeType, 'webm') => 'webm',
            str_contains($mimeType, 'quicktime') => 'mov',
            default => 'bin',
        };
    }
}
