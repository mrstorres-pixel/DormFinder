<?php

use App\Http\Middleware\ApiHeaders;
use App\Http\Middleware\EnsureActiveAccount;
use App\Http\Middleware\RequireCsrfToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->web(replace: [PreventRequestForgery::class => RequireCsrfToken::class]);
        $middleware->append(ApiHeaders::class);
        $middleware->alias(['active' => EnsureActiveAccount::class]);
        $middleware->trustProxies(
            headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO | Request::HEADER_X_FORWARDED_PORT,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*', 'sanctum/*') || $request->expectsJson(),
        );
        $exceptions->respond(function (Response $response): Response {
            if (! request()->is('api/*', 'sanctum/*') || $response->getStatusCode() < 400) {
                return $response;
            }

            $status = $response->getStatusCode();
            $body = json_decode($response->getContent(), true) ?? [];
            $messages = [
                401 => ['unauthenticated', 'Please sign in to continue.'],
                403 => ['forbidden', 'You do not have access to this action.'],
                404 => ['not_found', 'This resource could not be found.'],
                409 => ['conflict', 'This record changed. Refresh it before trying again.'],
                419 => ['session_expired', 'Your session expired. Refresh and try again.'],
                422 => ['validation_failed', 'Please check the highlighted fields.'],
                429 => ['rate_limited', 'Too many requests. Please wait and try again.'],
                503 => ['service_unavailable', 'The service is temporarily unavailable. Please retry.'],
            ];
            [$code, $message] = $messages[$status] ?? ['server_error', 'Something went wrong. Please try again.'];
            $requestId = request()->attributes->get('request_id', (string) Str::uuid());

            return response()->json([
                'code' => $code,
                'message' => $message,
                'errors' => $status === 422 ? ($body['errors'] ?? (object) []) : (object) [],
                'request_id' => $requestId,
            ], $status, array_filter([
                'Cache-Control' => 'no-store, private',
                'X-Request-ID' => $requestId,
                'Retry-After' => $response->headers->get('Retry-After'),
            ]));
        });
    })->create();
