# SignSpell backend (Laravel)

REST API for the SignSpell Angular app. Routes, rules and JSON shapes: `BACKEND_PLAN.md` (sections 5 to 8).

## Run it
1. `composer install` (PHP 8.4 or newer, because the locked packages need it)
2. `cp .env.example .env` then `php artisan key:generate`
3. Fill the database (`DB_*` for Supabase/PostgreSQL, see `.env.example`) and `CLOUDINARY_*` (or `CLOUDINARY_URL`). Set `FRONTEND_URL` to the Angular address (several, separated by commas, are allowed).
4. `php artisan migrate`
5. `php artisan signspell:make-admin` asks for the name, email, username and password of the first Super Admin (a wrong answer is explained and asked again). Nothing is built in.
6. `php artisan serve` and set the frontend's `apiUrl` in `src/environments/environment.ts` to `http://localhost:8000/api`.

### PHP upload limits (important)
PHP's defaults are too small for sign pictures and videos (2 MB per file, 8 MB per request) and uploads fail **before** Laravel can show a friendly message. In `php.ini` set:

```
upload_max_filesize = 30M
post_max_size = 64M      ; 12 pictures of 2 MB + a 25 MB video
max_file_uploads = 20
```

## Test it
`php artisan test` (SQLite in memory, a fake image store, no internet needed).

To run the same tests on real PostgreSQL (recommended before you deploy), create a local database `signspell_test` and a user `signspell` / `signspell` (or edit the values in `phpunit.pgsql.xml`), then run `php artisan test -c phpunit.pgsql.xml`.

## Good to know
- **Time zones:** the app should send `?tz=Asia/Manila` (the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone`) on `/me/attempts`, `/me/summary`, `/teacher/*` and `/admin/summary`. Date filters, the practice streak and "attempts today" then follow the person's own day. Without it, UTC is used.
- **Rate limits** (all in `config/signspell.php`): 120 requests a minute per person, 5 login tries a minute per username, 30 per address, 10 new accounts a minute per address, 120 attempts a minute.
- **Sessions:** a token lasts `SANCTUM_TOKEN_DAYS` (30). Changing a password signs the other devices out.
- **Deletes** need `?confirm=1`. Ask `/signs/{id}/impact` or `/admin/accounts/{id}/impact` first to show real numbers in the confirm dialog.
- The sign list is cached for 60 seconds and refreshed at once whenever a sign, an owner's name or an account changes.

## Where things are
- `routes/api.php` all routes, grouped by role. `bootstrap/app.php` the JSON error format.
- `config/signspell.php` every number (label rules, mastery thresholds, image limits, rate limits). Keep the mastery numbers equal to the frontend's `src/app/core/mastery.ts`.
- `app/Services/MasteryService.php` the only place that computes mastery (exact whole-number maths, retries a lost first-attempt race).
- `app/Services/ImageStore.php` + `CloudinaryImageStore.php` image and video storage.
