<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => mb_strtolower(trim((string) $this->input('email'))),
            'name' => is_string($this->input('name')) ? preg_replace('/\s+/u', ' ', trim($this->input('name'))) : $this->input('name'),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^(?=(?:[^\p{L}]*\p{L}){2})[\p{L}\p{M}][\p{L}\p{M} .\x{0027}\x{2019}-]*$/u'],
            'email' => ['required', 'email', 'max:254', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()],
            'role' => ['prohibited'], 'owner_id' => ['prohibited'], 'status' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return ['name.regex' => 'Use at least two letters. Accents, spaces, apostrophes, hyphens and initials are allowed.'];
    }
}
