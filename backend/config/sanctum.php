<?php

use App\Http\Middleware\RequireCsrfToken;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

return [
    'stateful' => array_filter(explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost:5173,127.0.0.1:5173'))),
    'guard' => ['web'],
    'expiration' => 120,
    'token_prefix' => '',
    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => RequireCsrfToken::class,
    ],
];
