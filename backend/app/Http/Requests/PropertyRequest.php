<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PropertyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'property_type' => ['required', Rule::in(['dormitory', 'apartment', 'boarding_house', 'rental_room'])],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
            'revision' => [$this->isMethod('patch') ? 'required' : 'prohibited', 'integer', 'min:1'],
            'landlord_id' => ['prohibited'], 'owner_id' => ['prohibited'],
            'status' => ['prohibited'], 'is_demo' => ['prohibited'],
        ];
    }
}
