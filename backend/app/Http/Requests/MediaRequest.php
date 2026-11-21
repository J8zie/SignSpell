<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MediaRequest extends FormRequest
{
    // Only the sign's owner or an admin may change its media.
    public function authorize(): bool
    {
        $sign = $this->route('sign');

        return $sign instanceof \App\Models\Sign && $this->user() && $sign->editableBy($this->user());
    }

    // True when the app sends the final picture order instead of re-uploading everything.
    public function keepsExisting(): bool
    {
        return $this->has('order');
    }

    // Lists the rules for the pictures, video, and order list.
    public function rules(): array
    {
        $imageMax = (int) config('signspell.image.max_kb');
        $videoMax = (int) config('signspell.video.max_kb');
        $keeps = $this->keepsExisting();

        return [
            // Order uses keep:<mediaId> for saved pictures and new:<n> for the nth uploaded file.
            'order' => ['nullable', 'array', 'min:'.(int) config('signspell.image.pictures_min'), 'max:'.(int) config('signspell.image.pictures_max')],
            'order.*' => ['string', 'regex:/^(keep:[0-9a-fA-F-]{36}|new:[0-9]{1,2})$/'],
            'keepVideo' => ['nullable', 'boolean'],
            'pictures' => $keeps
                ? ['nullable', 'array', 'max:'.(int) config('signspell.image.pictures_max')]
                : ['required', 'array', 'min:'.(int) config('signspell.image.pictures_min'), 'max:'.(int) config('signspell.image.pictures_max')],
            'pictures.*' => [
                'file',
                'mimetypes:'.implode(',', config('signspell.image.mimetypes')),
                'max:'.$imageMax,
            ],
            'video' => [
                'nullable',
                'file',
                'mimetypes:'.implode(',', config('signspell.video.mimetypes')),
                'max:'.$videoMax,
            ],
        ];
    }

    // Checks the order list really points at this sign's saved pictures and the uploaded files.
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (! $this->keepsExisting() || $validator->errors()->isNotEmpty()) {
                return;
            }

            $sign = $this->route('sign');
            $saved = $sign->media()->where('type', 'image')->pluck('media_id')->all();
            $files = count($this->file('pictures', []));
            $keeps = [];
            $news = [];

            foreach ((array) $this->input('order') as $token) {
                [$kind, $value] = explode(':', (string) $token, 2);
                if ($kind === 'keep') {
                    $keeps[] = strtolower($value);
                } else {
                    $news[] = (int) $value;
                }
            }

            $savedLower = array_map('strtolower', $saved);
            if (count(array_unique($keeps)) !== count($keeps) || array_diff($keeps, $savedLower)) {
                $validator->errors()->add('order', 'One of the saved pictures could not be found. Reload the sign and try again.');
            }

            // Each uploaded picture must appear exactly once in the order.
            sort($news);
            if ($news !== ($files > 0 ? range(0, $files - 1) : [])) {
                $validator->errors()->add('order', 'The new pictures do not match the order. Please try again.');
            }
        });
    }

    // Returns friendly error messages for the media form.
    public function messages(): array
    {
        return [
            'order.min' => 'Add at least one picture.',
            'order.max' => 'You can add up to '.(int) config('signspell.image.pictures_max').' pictures.',
            'order.*.regex' => 'The picture order is not valid.',
            'pictures.required' => 'Add at least one picture.',
            'pictures.min' => 'Add at least one picture.',
            'pictures.max' => 'You can add up to '.(int) config('signspell.image.pictures_max').' pictures.',
            'pictures.*.mimetypes' => 'Use a JPG, PNG, or WebP image.',
            'pictures.*.max' => 'Each picture must be '.((int) config('signspell.image.max_kb') / 1024).' MB or smaller.',
            'video.mimetypes' => 'Use an MP4, WebM, or MOV video.',
            'video.max' => 'The video must be '.((int) config('signspell.video.max_kb') / 1024).' MB or smaller.',
        ];
    }
}
