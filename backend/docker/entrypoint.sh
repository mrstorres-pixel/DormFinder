#!/bin/sh
set -eu
if [ -n "${DB_SSL_CA_BASE64:-}" ]; then
    printf '%s' "$DB_SSL_CA_BASE64" | base64 -d > /tmp/database-ca.pem
    export DB_SSLROOTCERT=/tmp/database-ca.pem
fi
php -r '
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
foreach (["app.key", "app.url", "dormfinder.frontend_url", "database.connections.pgsql.password", "filesystems.disks.s3.key", "filesystems.disks.s3.secret", "filesystems.disks.s3.endpoint"] as $key) {
    if (!config($key)) { fwrite(STDERR, "Missing production setting: ".$key.PHP_EOL); exit(1); }
}
if (! $app->isProduction() || config("app.debug") || !config("session.secure")
    || config("session.domain") || config("session.same_site") !== "lax"
    || config("session.driver") !== "database" || config("filesystems.default") !== "s3"
    || config("database.connections.pgsql.sslmode") !== "verify-full") {
    fwrite(STDERR, "Invalid production security settings.".PHP_EOL); exit(1);
}
'
php artisan config:cache
php-fpm -D
exec nginx -g 'daemon off;'

