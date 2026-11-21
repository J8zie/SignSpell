<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    // Always allows the request; anyone may try to log in.
    public function authorize(): bool
    {
        return true;
    }

    // Just needs a username and a password, nothing fancier.
    public function rules(): array
    {
        return [
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ];
    }

    // Returns friendly error messages for the login form.
    public function messages(): array
    {
        return [
            'username.required' => 'Enter a username.',
            'password.required' => 'Enter a password.',
        ];
    }
}
