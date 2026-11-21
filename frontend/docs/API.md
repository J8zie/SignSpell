# API contract (Laravel)

The frontend never talks to a database. Every call goes through one class, `Api` (`src/app/core/api/api.ts`),
implemented by `HttpApi`, which calls this contract at `apiUrl` in `src/environments/environment.ts`.

* JSON is **camelCase** (map from your snake_case columns in Eloquent API Resources). Types: `src/app/core/models.ts`.
* Auth: `Authorization: Bearer <token>` (Laravel Sanctum personal access tokens). Always send `Accept: application/json`.
* Errors: `401` not logged in (the app signs the user out), `403` wrong role, `404`, `422` validation
  `{ "message": "...", "errors": { "field": ["message"] } }` (the forms show these under the matching field).
* CORS: allow the frontend origin and the `Authorization` header.

## Endpoints

| Method | Path | Who | Body / query | Returns |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | guest | `username, password, role (learner\|teacher), firstName, lastName, email` | `{ token, account }` |
| POST | `/auth/login` | guest | `username, password` | `{ token, account }` (401 on wrong credentials) |
| POST | `/auth/logout` | any | | 204 |
| GET | `/auth/me` | any | | `Account` |
| POST | `/profile` | any | multipart: `_method=PUT, firstName, lastName, email, photo?` | `Account` |
| GET | `/signs` | any | `type?, q?, mine?=1` | `Sign[]` (`q` = label contains; `mine` = signs I donated) |
| GET | `/signs/{id}` | any | | `Sign` |
| POST | `/signs` | teacher, admin | multipart: `label, signType, image?, ownerId?` | `Sign` (a teacher is always the owner) |
| POST | `/signs/{id}` | admin | multipart: `_method=PUT, label, signType, ownerId?, image?` | `Sign` |
| DELETE | `/signs/{id}` | admin | | 204 (also delete its attempts and mastery) |
| POST | `/attempts` | learner | `signId, predictedLabel, confidence (0..1), isCorrect` | `{ attempt, mastery }` |
| GET | `/me/attempts` | learner | `signId?, type?, from?, to?, limit?` (dates `YYYY-MM-DD`, inclusive) | `Attempt[]` newest first |
| GET | `/me/mastery` | learner | | `Mastery[]` |
| GET | `/teacher/learners-progress` | teacher | `from?, to?, signId?` | `LearnerProgressRow[]` |
| GET | `/admin/accounts` | admin | `q?, role?` | `Account[]` |
| POST | `/admin/accounts` | admin | `username, password, role, firstName, lastName, email` | `Account` |
| PUT | `/admin/accounts/{id}` | admin | same; `password` optional (blank = keep) | `Account` |
| DELETE | `/admin/accounts/{id}` | admin | | 204 (cascade attempts and mastery; null the `userOwnershipId` of their signs) |

`Account` = `{ userId, username, role, info: { userinfoId, userId, firstName, lastName, email, profilePhotoUrl, createdAt } }`.
Images (sign pictures, profile photos) go to Cloudinary; return the secure URL as `imageUrl` / `profilePhotoUrl`.

## Rules the API must enforce

* **Roles.** Learners record attempts and read their own data. Teachers donate signs and read progress. Admins manage accounts and signs.
  Registration can only create `learner` or `teacher`.
* **Ownership (DFD 7.0).** `/teacher/learners-progress` returns rows only for signs where `userOwnershipId` = the logged-in teacher.
  A row groups one learner and one sign: `attemptsCount, correctAvg (0..1), masteryLevel, lastAttemptAt`.
* **Sign labels.** Stored UPPERCASE with single spaces. `letter` = 1 letter, `word` = 2 to 12 letters no spaces,
  `sentence` = 2 to 5 words, only A to Z. A label is unique within its type. Pictures: JPG/PNG/WebP, up to 2 MB.
* **Mastery** is updated by the API on every `POST /attempts` (one row per learner and sign):
  `attemptsCount += 1`, `correctAvg = (old * n + (isCorrect ? 1 : 0)) / (n + 1)`, then
  `mastered` if attempts >= 5 and avg >= 0.85, `familiar` if attempts >= 3 and avg >= 0.6, otherwise `learning`
  (`new` = no attempts). Change the thresholds in `src/app/core/mastery.ts` and in Laravel together.
* **What an attempt means.** Letter signs: one attempt per confirmed sign. Word and sentence signs: every confirmed letter
  also posts an attempt for that *letter's* sign, and the word or sentence itself posts one attempt when it finishes or times out
  (`predictedLabel` = what was spelled so far).
* **Privacy.** Video never reaches the server. Only the attempt fields above are sent.
