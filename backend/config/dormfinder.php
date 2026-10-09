<?php

return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),
    'trusted_proxies' => array_filter(explode(',', env('TRUSTED_PROXIES', ''))),
    'max_photos' => 8,
    'signed_url_minutes' => 5,
    'demo_seed_enabled' => env('DEMO_SEED_ENABLED', false),
];
