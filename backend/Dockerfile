# SignSpell API — Laravel 13 on PHP 8.4, PostgreSQL (Supabase), Cloudinary, Gemini.
# composer.lock resolves Symfony packages that require PHP >= 8.4.1.
FROM php:8.4-cli

# Postgres driver + opcache; unzip/git are needed by Composer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev $PHPIZE_DEPS unzip git \
    && docker-php-ext-install pdo_pgsql opcache \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install dependencies first so this layer is cached when only app code changes.
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-scripts --no-autoloader \
    && rm -rf /root/.composer/cache

COPY . .
# storage/ is gitignored, so make sure Laravel's writable dirs exist in the image.
RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/app/public bootstrap/cache \
    && composer dump-autoload --optimize --no-dev \
    && php artisan package:discover --ansi

# Render (and most hosts) inject the port; 10000 is Render's default.
EXPOSE 10000

# Migrate, cache config/routes, then serve. `serve` is single-threaded — fine for this API size.
CMD ["sh", "-c", "php artisan migrate --force && php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"]
