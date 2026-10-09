<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;

class RequireCsrfToken extends PreventRequestForgery
{
    /** Require a CSRF token even when a proxy forwards Sec-Fetch-Site: same-origin. */
    protected function hasValidOrigin($request): bool
    {
        return false;
    }
}
