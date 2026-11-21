<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PasswordRequest extends FormRequest
{
    // Always allows the request; the user is already logged in.
    public function authorize(): bool
    {
        return true;
    }

    // Needs the current password plus a new one that follows the password rules.
    public function rules(): array
    {
        return [
            'currentPassword' => ['required', 'string'],
            'newPassword' => RegisterRequest::passwordRules(true, $this->user()?->username),
        ];
    }

    // Returns friendly error messages for the password form.
    public function messages(): array
    {
        return [
            'currentPassword.required' => 'Enter your current password.',
            'newPassword.required' => 'Enter a new password.',
            'newPassword.min' => 'The password must be at least 8 characters.',
        ];
    }
}
