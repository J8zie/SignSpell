<?php

namespace App\Http\Requests;

use App\Models\Sign;
use App\Rules\SignLabel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SignRequest extends FormRequest
{
    // Always allows the request; sign permissions are checked in the controller.
    public function authorize(): bool
    {
        return true;
    }

    // Turns an empty ownerId into null so "no owner" is handled cleanly.
    protected function prepareForValidation(): void
    {
        if ($this->input('ownerId') === '') {
            $this->merge(['ownerId' => null]);
        }
    }

    // Lists the rules for a sign's label, type, image, and owner.
    public function rules(): array
    {
        $sign = $this->route('sign');
        $ignore = $sign instanceof Sign ? $sign->sign_id : (is_string($sign) ? $sign : null);
        $creating = $this->isMethod('post') && $ignore === null;

        return [
            'label' => ['required', 'string', new SignLabel($ignore)],
            'signType' => ['required', 'in:letter,word,sentence'],
            'image' => [
                $creating ? 'required' : 'nullable',
                'file',
                'mimetypes:'.implode(',', config('signspell.image.mimetypes')),
                'max:'.(int) config('signspell.image.max_kb'),
            ],
            'ownerId' => [
                'nullable',
                'uuid',
                Rule::exists('users', 'user_id')->where(fn ($query) => $query->where('role', 'teacher')),
            ],
        ];
    }

    // Returns friendly error messages for the sign form.
    public function messages(): array
    {
        $megabytes = (int) config('signspell.image.max_kb') / 1024;

        return [
            'label.required' => 'Enter a label.',
            'signType.required' => 'Choose a letter, word, or sentence.',
            'signType.in' => 'Choose a letter, word, or sentence.',
            'image.required' => 'Choose an image for this sign.',
            'image.mimetypes' => 'Use a JPG, PNG, or WebP image.',
            'image.max' => 'The image must be '.$megabytes.' MB or smaller.',
            'ownerId.exists' => 'Choose a teacher as the owner.',
            'ownerId.uuid' => 'Choose a teacher as the owner.',
        ];
    }
}
