<?php

namespace App\Http\Controllers;

use App\Http\Requests\SignRequest;
use App\Http\Resources\SignResource;
use App\Models\Sign;
use App\Rules\SignLabel;
use App\Services\Audit;
use App\Services\ImageStore;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Throwable;

class SignController extends Controller
{
    // Returns a cached, filtered list of signs.
    public function index(Request $request)
    {
        validator($request->query(), [
            'type' => ['nullable', 'in:letter,word,sentence'],
            'q' => ['nullable', 'string', 'max:80'],
            'owner' => ['nullable', 'string', function (string $attribute, mixed $value, \Closure $fail) {
                if ($value !== 'none' && ! \Illuminate\Support\Str::isUuid((string) $value)) {
                    $fail('Choose a teacher from the list.');
                }
            }],
            'sort' => ['nullable', 'in:label,-createdAt'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'page' => ['nullable', 'integer', 'min:1'],
        ], [
            'type.in' => 'Choose a letter, word, or sentence.',
            'limit.min' => 'Ask for at least one sign.',
            'limit.max' => 'Ask for 500 signs or fewer.',
        ])->validate();

        $version = (int) Cache::get('signs.cache_version', 1);
        $query = $request->query();
        ksort($query);
        $key = 'signs.v'.$version.'.'.sha1(json_encode([
            'user' => $request->user()->user_id,
            'query' => $query,
        ]));

        $payload = Cache::remember($key, (int) config('signspell.signs_cache_seconds'), function () use ($request) {
            return $this->signList($request);
        });

        $response = response()->json($payload['data']);
        if ($payload['total'] !== null) {
            $response->headers->set('X-Total-Count', (string) $payload['total']);
        }

        return $response;
    }

    // Returns one sign's full details.
    public function show(Sign $sign)
    {
        return new SignResource($sign->load(['owner.info']));
    }

    // Creates a new sign with its uploaded image.
    public function store(SignRequest $request, ImageStore $images)
    {
        $stored = $images->upload($request->file('image'), 'signs');

        try {
            $sign = Sign::query()->create([
                'sign_type' => $request->string('signType')->toString(),
                'label' => SignLabel::normalize($request->string('label')->toString()),
                'image_url' => $stored['url'],
                'image_public_id' => $stored['public_id'],
                'userownership_id' => $this->ownerId($request),
            ]);
        } catch (UniqueConstraintViolationException) {
            $images->delete($stored['public_id']);
            throw ValidationException::withMessages([
                'label' => 'This word already exists.',
            ]);
        } catch (Throwable $e) {
            $images->delete($stored['public_id']);
            throw $e;
        }

        self::forgetSignsCache();

        Audit::record($request->user(), Audit::SIGN_CREATE, $request, 'sign', $sign->sign_id, "Created {$sign->sign_type} sign \"{$sign->label}\".", null, [
            'sign_type' => $sign->sign_type, 'label' => $sign->label, 'owner' => $sign->userownership_id,
        ]);

        return (new SignResource($sign->load(['owner.info'])))->response()->setStatusCode(201);
    }

    // Updates a sign's details, and swaps its image if a new one was uploaded.
    public function update(SignRequest $request, Sign $sign, ImageStore $images)
    {
        $stored = null;
        if ($request->hasFile('image')) {
            $stored = $images->upload($request->file('image'), 'signs');
        }

        $previous = $sign->image_public_id;
        $before = ['sign_type' => $sign->sign_type, 'label' => $sign->label, 'owner' => $sign->userownership_id];
        $sign->sign_type = $request->string('signType')->toString();
        $sign->label = SignLabel::normalize($request->string('label')->toString());

        if ($request->exists('ownerId')) {
            $sign->userownership_id = $request->filled('ownerId') ? $request->string('ownerId')->toString() : null;
        }

        if ($stored) {
            $sign->image_url = $stored['url'];
            $sign->image_public_id = $stored['public_id'];
        }

        try {
            $sign->save();
        } catch (UniqueConstraintViolationException) {
            if ($stored) {
                $images->delete($stored['public_id']);
            }
            throw ValidationException::withMessages([
                'label' => 'This word already exists.',
            ]);
        } catch (Throwable $e) {
            if ($stored) {
                $images->delete($stored['public_id']);
            }
            throw $e;
        }

        if ($stored && $previous && $previous !== $stored['public_id']) {
            try {
                $images->delete($previous);
            } catch (Throwable $e) {
                report($e);
            }
        }

        self::forgetSignsCache();

        Audit::record($request->user(), Audit::SIGN_UPDATE, $request, 'sign', $sign->sign_id, "Updated sign \"{$sign->label}\".", $before, [
            'sign_type' => $sign->sign_type, 'label' => $sign->label, 'owner' => $sign->userownership_id, 'image_changed' => (bool) $stored,
        ]);

        return new SignResource($sign->load(['owner.info']));
    }

    // Deletes a sign from the database and removes all its uploaded files.
    public function destroy(Request $request, Sign $sign, ImageStore $images)
    {
        $this->requireConfirm($request);

        $files = [];
        if ($sign->image_public_id) {
            $files[] = [$sign->image_public_id, 'image'];
        }
        foreach ($sign->media as $media) {
            $files[] = [$media->public_id, $media->type === 'video' ? 'video' : 'image'];
        }

        $snapshot = ['sign_type' => $sign->sign_type, 'label' => $sign->label, 'owner' => $sign->userownership_id];

        // The database row goes first so a storage failure can never block the delete.
        $sign->delete();

        Audit::record($request->user(), Audit::SIGN_DELETE, $request, 'sign', $sign->sign_id, "Deleted {$snapshot['sign_type']} sign \"{$snapshot['label']}\".", $snapshot);

        foreach ($files as [$publicId, $type]) {
            try {
                $images->delete($publicId, $type);
            } catch (Throwable $e) {
                report($e);
            }
        }

        self::forgetSignsCache();

        return response()->noContent();
    }

    // Returns usage stats for one sign: attempts, learners, and media count.
    public function impact(Sign $sign)
    {
        return response()->json([
            'attempts' => $sign->attempts()->count(),
            'learners' => $sign->attempts()->distinct()->count('learners_id'),
            'media' => $sign->media()->count(),
        ]);
    }

    // Busts all cached sign lists by bumping a version number.
    public static function forgetSignsCache(): void
    {
        Cache::forever('signs.cache_version', ((int) Cache::get('signs.cache_version', 1)) + 1);
    }

    // Builds the filtered sign list that index caches and returns.
    private function signList(Request $request): array
    {
        $query = Sign::query()
            ->select(['sign_id', 'sign_type', 'label', 'image_url', 'userownership_id', 'created_at'])
            ->with(['owner.info']);

        if ($request->filled('type')) {
            $query->where('sign_type', $request->query('type'));
        }

        $term = SignLabel::normalize((string) $request->query('q', ''));
        if ($term !== '') {
            $escaped = addcslashes($term, '%_\\');
            $query->where('label', 'like', '%'.$escaped.'%');
            $query->orderByRaw('case when label = ? then 0 when label like ? then 1 else 2 end', [$term, $escaped.'%']);
        }

        if ((string) $request->query('mine') === '1') {
            $query->where('userownership_id', $request->user()->user_id);
        }

        if ((string) $request->query('donated') === '1') {
            $query->whereNotNull('userownership_id');
        }

        if ($request->filled('owner') && $request->user()->isAdmin()) {
            if ($request->query('owner') === 'none') {
                $query->whereNull('userownership_id');
            } else {
                $query->where('userownership_id', $request->query('owner'));
            }
        }

        $sort = $request->query('sort');
        if ($sort === 'label' || ($sort === null && $request->query('type') === 'letter')) {
            $query->orderBy('label');
        } else {
            $query->orderByDesc('created_at');
        }

        $paginated = $request->filled('limit') || $request->filled('page');
        $total = null;
        if ($paginated) {
            $total = (clone $query)->count();
            $query->forPage(
                max((int) $request->input('page', 1), 1),
                (int) $request->input('limit', 50),
            );
        }

        return [
            'data' => SignResource::collection($query->get())->resolve($request),
            'total' => $total,
        ];
    }

    // Works out the owner of a new sign (teachers always own what they add).
    private function ownerId(Request $request): ?string
    {
        if ($request->user()->role === 'teacher') {
            return $request->user()->user_id;
        }

        return $request->filled('ownerId') ? $request->string('ownerId')->toString() : null;
    }

    // Requires ?confirm=1 in the URL before allowing a dangerous action.
    private function requireConfirm(Request $request): void
    {
        if ((string) $request->query('confirm') !== '1') {
            throw ValidationException::withMessages([
                'confirm' => 'Please confirm this action first.',
            ]);
        }
    }
}
