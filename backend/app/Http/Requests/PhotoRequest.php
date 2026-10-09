<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'photo' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:3072'],
            'caption' => ['nullable', 'string', 'max:160'],
            'upload_id' => ['required', 'uuid'],
            'revision' => ['required', 'integer', 'min:1'],
        ];
    }
}
