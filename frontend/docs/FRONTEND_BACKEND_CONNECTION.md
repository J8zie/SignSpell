# Connecting the frontend to your backend

> **Status: connected.** The whole app talks to the Laravel API, including hints and word/sentence media (`HttpHintRepository`, `HttpLessonMediaRepository`). Notes the code relies on:
>
> - **Deletes** (`DELETE /signs/{id}`, `DELETE /admin/accounts/{id}`) are sent with `?confirm=1`, after the confirm dialog asked `/signs/{id}/impact` or `/admin/accounts/{id}/impact` for real numbers.
> - **Time zone:** `?tz=<browser zone>` is added to `/me/attempts`, `/me/summary`, `/teacher/learners-progress`, its export and `/admin/summary`, so days follow the person's own day.
> - **Media saves** send the final order only (`order[]` = `keep:<mediaId>` or `new:<n>`, plus `keepVideo`), so pictures already saved are never uploaded again.
> - **Summaries** (`/me/summary`, `/teacher/summary`, `/admin/summary`), the CSV export and `POST /profile/password` are used by the home, students and profile screens.
> - **Unsaved work** (profile, both sign studios) asks before leaving; **search and filters** of People and Signs live in the address (`?q=&type=&role=&donated=1`).
> - A sign that was created but whose pictures or hint failed to save is continued on the next Save (it is never created twice).


The frontend never talks to a server directly from a screen. Screens call small data classes, so connecting the
backend means replacing those classes, not rewriting the screens. Every spot is marked in the code with
`BACKEND INTEGRATION POINT` (13 places).

## 1. What already talks to the backend (the existing contract)

`src/app/core/api/api.ts` is the contract; `HttpApi` implements it against the real API (`apiUrl` in `src/environments/environment.ts`).

## 2. Hints and media (on the server)

Both live in `src/app/data/` and are wired in `src/app/app.config.ts`.

| Data | Abstract class (the contract) | Implementation |
| --- | --- | --- |
| Teacher hint of a sign | `HintRepository` (`get`, `getAll`, `save`, `remove`) | `HttpHintRepository` |
| Pictures in order and video of a word or sentence | `LessonMediaRepository` (`get`, `save`, `remove`) | `HttpLessonMediaRepository` |

### Shape of one media item (what the upload screen produces)

```ts
{ id, type: 'image' | 'video', name, url, previewUrl, sequence, file }
```

`sequence` is 1, 2, 3... for pictures (1 is the START picture) and `null` for the video. `file` is the chosen file to
upload. `url` and `previewUrl` are temporary local addresses; your backend should return permanent ones.
The first picture is also sent through the existing `createSign({ image })` call, so the current API keeps working.

## 3. Timelines use real dates only

`DateTimeline` draws one dot per date it is given and spaces the dots evenly, so dates without data are never implied.

- Learner history: built from the learner's own attempts (`myAttempts`). Nothing to change.
- Teacher workspace: built from `lastAttemptAt` of the progress rows, so a dot means "a learner last practiced on this
  day". When your backend can return every day that has attempts, pass those dates instead (see `students.ts`).

## 4. Roles (UI only, NOT security)

The frontend now knows four role strings: `learner`, `teacher`, `admin`, `super_admin` (`core/models.ts`).
`core/permissions.ts` decides only what the screens SHOW. Your backend must enforce, on its own:

- only a Super Admin may create, edit or delete Admin accounts (the Admin screens never offer it);
- an Admin must not be able to read or change Admin or Super Admin accounts;
- a teacher only sees progress on signs that teacher donated;
- a learner only sees their own attempts and mastery.

If your database restricts `role` values (for example a CHECK constraint), add `super_admin`.
