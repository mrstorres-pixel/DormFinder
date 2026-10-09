FROM php:8.4-fpm-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends nginx libpq-dev libpng-dev libjpeg62-turbo-dev libwebp-dev libfreetype6-dev libzip-dev libicu-dev libonig-dev ca-certificates unzip \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install -j2 pdo_pgsql gd exif intl zip mbstring opcache \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY . .
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views \
    && chown -R www-data:www-data storage bootstrap/cache
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/pool.conf /usr/local/etc/php-fpm.d/zz-dormfinder.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/dormfinder.ini
RUN chmod +x docker/entrypoint.sh
EXPOSE 10000
ENTRYPOINT ["/var/www/html/docker/entrypoint.sh"]

