<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AttemptRequest extends FormRequest
{
    // Always allows the request; the route already requires a learner.
    public function authorize(): bool
    {
        return true;
    }

    // Lists the rules a practice attempt must pass.
    public function rules(): array
    {
        return [
            'signId' => ['required', 'uuid', 'exists:signs,sign_id'],
            'predictedLabel' => ['required', 'string', 'max:'.(int) config('signspell.attempt.predicted_label_max')],
            'confidence' => ['required', 'numeric', 'between:0,1'],
            'isCorrect' => ['required', 'boolean'],
        ];
    }

    // Returns friendly error messages for the attempt form.
    public function messages(): array
    {
        return [
            'signId.required' => 'Choose a sign.',
            'signId.exists' => 'We could not find that sign.',
            'signId.uuid' => 'We could not find that sign.',
            'predictedLabel.required' => 'Enter the predicted label.',
            'predictedLabel.max' => 'The predicted label is too long.',
            'confidence.required' => 'Enter a confidence score.',
            'confidence.between' => 'Confidence must be between 0 and 1.',
            'isCorrect.required' => 'Say whether the attempt was correct.',
            'isCorrect.boolean' => 'Say whether the attempt was correct.',
        ];
    }
}
