<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminBrowse
{
    public static function filters(Request $request, array $rules = []): array
    {
        return $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'between:1,100000'],
            'per_page' => ['nullable', 'integer', Rule::in([12, 20, 24, 48])],
        ], $rules));
    }

    public static function pattern(string $term): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower(trim($term))).'%';
    }

    public static function propertySearch(Builder $query, ?string $term): void
    {
        if (! filled(trim($term ?? ''))) {
            return;
        }
        $pattern = self::pattern($term);
        $query->where(function (Builder $query) use ($pattern): void {
            $query->whereRaw('lower(title) LIKE ?', [$pattern])
                ->orWhereRaw('lower(coalesce(address, ?)) LIKE ?', ['', $pattern])
                ->orWhereRaw('lower(city) LIKE ?', [$pattern])
                ->orWhereHas('landlord', fn (Builder $owner) => $owner->whereRaw('lower(name) LIKE ?', [$pattern])->orWhereRaw('lower(email) LIKE ?', [$pattern]));
        });
    }
}
