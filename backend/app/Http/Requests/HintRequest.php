<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class HintRequest extends FormRequest
{
    // Only the sign's owner or an admin may change its hint.
    public function authorize(): bool
    {
        $sign = $this->route('sign');

        return $sign instanceof \App\Models\Sign && $this->user() && $sign->editableBy($this->user());
    }

    // The hint text may be empty, which means "no hint".
    public function rules(): array
    {
        return [
            'text' => ['present', 'nullable', 'string', 'max:'.(int) config('signspell.hint_max_chars')],
        ];
    }

    // Returns friendly error messages for the hint form.
    public function messages(): array
    {
        return [
            'text.present' => 'Enter a hint.',
            'text.max' => 'A hint can be '.(int) config('signspell.hint_max_chars').' characters or fewer.',
        ];
    }
}
