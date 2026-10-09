<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoomOptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'revision' => ['required', 'integer', 'min:1'],
            'name' => ['required', 'string', 'max:100'],
            'inventory_type' => ['required', Rule::in(['bedspace', 'whole_room'])],
            'price_basis' => ['required', Rule::in([$this->input('inventory_type') === 'bedspace' ? 'per_person' : 'per_room'])],
            'capacity' => ['required', 'integer', 'between:1,20'],
            'total_units' => ['required', 'integer', 'between:1,1000'],
            'available_units' => ['required', 'integer', 'min:0', 'lte:total_units'],
            'monthly_rent_centavos' => ['required', 'integer', 'between:1,100000000'],
            'deposit_centavos' => ['required', 'integer', 'between:0,100000000'],
            'advance_months' => ['required', 'integer', 'between:0,12'],
            'utilities_notes' => ['required', 'string', 'max:2000'],
            'fees' => ['present', 'array', 'max:10'],
            'fees.*' => ['array:name,frequency,amount_centavos'],
            'fees.*.name' => ['required', 'string', 'max:100', 'distinct:ignore_case'],
            'fees.*.frequency' => ['required', Rule::in(['monthly', 'one_time'])],
            'fees.*.amount_centavos' => ['required', 'integer', 'between:0,100000000'],
            'property_id' => ['prohibited'], 'availability_confirmed_at' => ['prohibited'],
        ];
    }
}
