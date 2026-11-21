<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AccountRequest extends FormRequest
{
    // Always allows the request; the controller checks who may manage accounts.
    public function authorize(): bool
    {
        return true;
    }

    // Trims text fields and turns an empty password into "no change".
    protected function prepareForValidation(): void
    {
        $merge = [
            'username' => is_string($this->username) ? trim($this->username) : $this->username,
            'firstName' => is_string($this->firstName) ? trim($this->firstName) : $this->firstName,
            'lastName' => is_string($this->lastName) ? trim($this->lastName) : $this->lastName,
            'email' => is_string($this->email) ? mb_strtolower(trim($this->email)) : $this->email,
        ];

        if ($this->isMethod('put') || $this->isMethod('patch')) {
            if ($this->input('password') === '' || $this->input('password') === null) {
                $merge['password'] = null;
            }
        }

        $this->merge($merge);
    }

    // Lists the rules every account field must pass.
    public function rules(): array
    {
        $user = $this->route('user');
        $ignore = $user instanceof \App\Models\User ? $user->user_id : (is_string($user) ? $user : null);
        $creating = $this->isMethod('post');

        return [
            'username' => RegisterRequest::usernameRules($ignore),
            'password' => RegisterRequest::passwordRules($creating),
            'role' => ['required', Rule::in(config('signspell.roles'))],
            'firstName' => RegisterRequest::nameRules(),
            'lastName' => RegisterRequest::nameRules(),
            'email' => RegisterRequest::emailRules($ignore),
            'status' => ['sometimes', Rule::in(['active', 'disabled'])],
        ];
    }

    // Returns friendly error messages for the account form.
    public function messages(): array
    {
        return array_merge(RegisterRequest::messageBag(), [
            'role.in' => 'Choose a valid role.',
        ]);
    }
}
