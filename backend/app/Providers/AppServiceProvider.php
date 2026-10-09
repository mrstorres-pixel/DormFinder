<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        TrustProxies::at(config('dormfinder.trusted_proxies'));
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by('login:'.hash('sha256', mb_strtolower((string) $request->input('email')).'|'.$request->ip())),
            Limit::perMinute(30)->by('login-ip:'.$request->ip()),
        ]);
        RateLimiter::for('registration', fn (Request $request) => Limit::perHour(10)->by($request->ip()));
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(12)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('messages', fn (Request $request) => Limit::perMinute(20)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('reports', fn (Request $request) => Limit::perHour(10)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));

        if ($this->app->isProduction() && ! $this->app->runningInConsole()) {
            if (config('app.debug') || ! config('session.secure') || config('filesystems.default') !== 's3'
                || config('database.connections.pgsql.sslmode') !== 'verify-full') {
                throw new \RuntimeException('Production requires disabled debug, secure cookies, S3 storage and verified database TLS.');
            }
        }
    }
}
