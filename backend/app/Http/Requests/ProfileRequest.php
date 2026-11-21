<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProfileRequest extends FormRequest
{
    // Always allows the request; it only edits the logged-in user's own profile.
    public function authorize(): bool
    {
        return true;
    }

    // Trims the name fields and lowercases the email before checking them.
    protected function prepareForValidation(): void
    {
        $this->merge([
            'firstName' => is_string($this->firstName) ? trim($this->firstName) : $this->firstName,
            'lastName' => is_string($this->lastName) ? trim($this->lastName) : $this->lastName,
            'email' => is_string($this->email) ? mb_strtolower(trim($this->email)) : $this->email,
        ]);
    }

    // Lists the rules for the profile form fields.
    public function rules(): array
    {
        return [
            'firstName' => RegisterRequest::nameRules(),
            'lastName' => RegisterRequest::nameRules(),
            'email' => RegisterRequest::emailRules($this->user()?->user_id),
            'photo' => $this->imageRules(false),
        ];
    }

    // Returns friendly error messages for the profile form.
    public function messages(): array
    {
        return array_merge(RegisterRequest::messageBag(), $this->imageMessages('photo'));
    }

    // Builds the file rules for an uploaded image (required or optional).
    private function imageRules(bool $required): array
    {
        return [
            $required ? 'required' : 'nullable',
            'file',
            'mimetypes:'.implode(',', config('signspell.image.mimetypes')),
            'max:'.(int) config('signspell.image.max_kb'),
        ];
    }

    // Builds the error messages for an image upload field.
    private function imageMessages(string $field): array
    {
        $megabytes = (int) config('signspell.image.max_kb') / 1024;

        return [
            $field.'.mimetypes' => 'Use a JPG, PNG, or WebP image.',
            $field.'.max' => 'The image must be '.$megabytes.' MB or smaller.',
        ];
    }
}
