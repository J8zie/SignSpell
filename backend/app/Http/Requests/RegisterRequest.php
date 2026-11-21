<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Models\UserInfo;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    // Always allows the request; anyone may sign up as learner or teacher.
    public function authorize(): bool
    {
        return true;
    }

    // Trims the text fields and lowercases the email before checking them.
    protected function prepareForValidation(): void
    {
        $this->merge([
            'username' => is_string($this->username) ? trim($this->username) : $this->username,
            'firstName' => is_string($this->firstName) ? trim($this->firstName) : $this->firstName,
            'lastName' => is_string($this->lastName) ? trim($this->lastName) : $this->lastName,
            'email' => is_string($this->email) ? mb_strtolower(trim($this->email)) : $this->email,
        ]);
    }

    // Lists the rules every signup field must pass.
    public function rules(): array
    {
        return [
            'username' => self::usernameRules(),
            'password' => self::passwordRules(true),
            'role' => ['required', 'in:learner,teacher'],
            'firstName' => self::nameRules(),
            'lastName' => self::nameRules(),
            'email' => self::emailRules(),
        ];
    }

    // Returns friendly error messages for the signup form.
    public function messages(): array
    {
        return self::messageBag();
    }

    // Builds the username rules, including a not-taken check that ignores one user.
    public static function usernameRules(?string $ignoreUserId = null): array
    {
        return [
            'required',
            'string',
            'regex:/^[A-Za-z0-9_.]{3,20}$/',
            function (string $attribute, mixed $value, Closure $fail) use ($ignoreUserId) {
                $query = User::query()->whereRaw('lower(username) = ?', [mb_strtolower((string) $value)]);
                if ($ignoreUserId) {
                    $query->where('user_id', '!=', $ignoreUserId);
                }
                if ($query->exists()) {
                    $fail('That username is already taken.');
                }
            },
        ];
    }

    // Builds the password rules, including "must differ from the username".
    public static function passwordRules(bool $required, ?string $username = null): array
    {
        return [
            $required ? 'required' : 'nullable',
            'string',
            'min:8',
            function (string $attribute, mixed $value, Closure $fail) use ($username) {
                if (! is_string($value) || $value === '') {
                    return;
                }

                $name = $username;
                if ($name === null && is_string(request()->input('username'))) {
                    $name = request()->input('username');
                }

                if (is_string($name) && $name !== '' && strcasecmp($value, $name) === 0) {
                    $fail('The password must be different from the username.');
                }
            },
        ];
    }

    // Just needs a non-empty name up to 60 characters.
    public static function nameRules(): array
    {
        return ['required', 'string', 'max:60'];
    }

    // Builds the email rules, including a not-registered check that ignores one user.
    public static function emailRules(?string $ignoreUserId = null): array
    {
        return [
            'required',
            'string',
            'email',
            'max:120',
            function (string $attribute, mixed $value, Closure $fail) use ($ignoreUserId) {
                $email = mb_strtolower(trim((string) $value));
                $query = UserInfo::query()->whereRaw('lower(email) = ?', [$email]);
                if ($ignoreUserId) {
                    $query->where('user_id', '!=', $ignoreUserId);
                }
                if ($query->exists()) {
                    $fail('That email is already registered.');
                }
            },
        ];
    }

    // Returns the shared pool of friendly error messages.
    public static function messageBag(): array
    {
        return [
            'username.required' => 'Enter a username.',
            'username.regex' => 'Usernames are 3 to 20 letters, numbers, dots, or underscores.',
            'password.required' => 'Enter a password.',
            'password.min' => 'The password must be at least 8 characters.',
            'role.required' => 'Choose learner or teacher.',
            'role.in' => 'Please choose learner or teacher.',
            'firstName.required' => 'Enter a first name.',
            'lastName.required' => 'Enter a last name.',
            'firstName.max' => 'The first name must be 60 characters or fewer.',
            'lastName.max' => 'The last name must be 60 characters or fewer.',
            'email.required' => 'Enter an email address.',
            'email.email' => 'Enter a valid email address.',
            'email.max' => 'The email must be 120 characters or fewer.',
        ];
    }
}
