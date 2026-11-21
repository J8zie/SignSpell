<?php

namespace App\Http\Controllers;

use App\Http\Requests\AccountRequest;
use App\Http\Resources\AccountResource;
use App\Models\Attempt;
use App\Models\Sign;
use App\Models\User;
use App\Services\Audit;
use App\Services\ImageStore;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class AccountController extends Controller
{
    // Lists accounts the admin may see, with optional role filter and search.
    public function index(Request $request)
    {
        $actor = $request->user();
        $query = User::query()->with('info');

        if ($actor->role !== 'super_admin') {
            $query->whereIn('role', ['learner', 'teacher']);
        }

        if ($request->filled('role')) {
            $role = $request->string('role')->toString();
            if ($actor->role !== 'super_admin' && in_array($role, ['admin', 'super_admin'], true)) {
                return AccountResource::collection(collect());
            }
            $query->where('role', $role);
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $like = '%'.addcslashes(mb_strtolower($term), '%_\\').'%';
            $query->where(function ($inner) use ($like) {
                $inner->whereRaw('lower(username) like ?', [$like])
                    ->orWhereHas('info', function ($info) use ($like) {
                        $info->whereRaw('lower(first_name) like ?', [$like])
                            ->orWhereRaw('lower(last_name) like ?', [$like])
                            ->orWhereRaw('lower(email) like ?', [$like]);
                    });
            });
        }

        return AccountResource::collection($query->orderBy('username')->get());
    }

    // Creates a new account and returns it.
    public function store(AccountRequest $request)
    {
        $this->guardRole($request->user(), null, $request->string('role')->toString());

        try {
            $user = $this->saveNew($request);
        } catch (UniqueConstraintViolationException $e) {
            throw ValidationException::withMessages(self::duplicateField($e));
        }

        Audit::record($request->user(), Audit::ACCOUNT_CREATE, $request, 'user', $user->user_id, "Created account {$user->username} ({$user->role}).", null, [
            'username' => $user->username, 'role' => $user->role, 'status' => $user->status,
        ]);

        return (new AccountResource($user))->response()->setStatusCode(201);
    }

    // Updates an account's details, and resets its login tokens if the password changed.
    public function update(AccountRequest $request, User $user)
    {
        $role = $request->string('role')->toString();
        $this->guardRole($request->user(), $user, $role);
        $this->guardLastSuper($user, $role);

        $passwordChanged = $request->filled('password');
        $newStatus = $request->input('status', $user->status);
        $this->guardSelfDisable($request, $user, $newStatus);

        $before = ['username' => $user->username, 'role' => $user->role, 'status' => $user->status];

        try {
            // Both tables save together so an account is never half-updated.
            DB::transaction(function () use ($request, $user, $role, $passwordChanged, $newStatus) {
                $user->username = $request->string('username')->toString();
                $user->role = $role;
                $user->status = $newStatus;
                if ($passwordChanged) {
                    $user->password = $request->string('password')->toString();
                }
                $user->save();
                $user->info->fill([
                    'first_name' => $request->string('firstName')->toString(),
                    'last_name' => $request->string('lastName')->toString(),
                    'email' => $request->string('email')->toString(),
                ])->save();
            });
        } catch (UniqueConstraintViolationException $e) {
            throw ValidationException::withMessages(self::duplicateField($e));
        }

        // A password change or deactivation logs the user out of all other sessions.
        if ($passwordChanged || $newStatus === 'disabled') {
            $user->tokens()->delete();
        }
        SignController::forgetSignsCache();

        $after = ['username' => $user->username, 'role' => $user->role, 'status' => $user->status];
        Audit::record($request->user(), Audit::ACCOUNT_UPDATE, $request, 'user', $user->user_id, "Updated account {$user->username}.", $before, $after);

        return new AccountResource($user->load('info'));
    }

    // Deletes an account after the admin confirms, and removes its profile photo.
    public function destroy(Request $request, User $user, ImageStore $images)
    {
        $this->requireConfirm($request);

        if ($request->user()->user_id === $user->user_id) {
            abort(409, 'You cannot delete your own account.');
        }

        $this->guardRole($request->user(), $user, null);
        $this->guardLastSuper($user, null);
        $this->guardSelfDisable($request, $user, 'disabled');

        $photo = $user->info?->profile_photo_public_id;
        $snapshot = ['username' => $user->username, 'role' => $user->role, 'status' => $user->status];

        $user->tokens()->delete();
        $user->delete();
        SignController::forgetSignsCache();

        Audit::record($request->user(), Audit::ACCOUNT_DELETE, $request, 'user', $user->user_id, "Deleted account {$snapshot['username']} ({$snapshot['role']}).", $snapshot);

        // Photo deletion failure is only logged so it never blocks the account delete.
        try {
            $images->delete($photo);
        } catch (Throwable $e) {
            report($e);
        }

        return response()->noContent();
    }

    // Returns how many attempts the user made and how many signs they donated.
    public function impact(Request $request, User $user)
    {
        $this->guardRole($request->user(), $user, null);

        return response()->json([
            'attempts' => Attempt::query()->where('learners_id', $user->user_id)->count(),
            'signsDonated' => Sign::query()->where('userownership_id', $user->user_id)->count(),
        ]);
    }

    /** Says which field was the duplicate, so the form puts the message under the right input. */
    private static function duplicateField(UniqueConstraintViolationException $e): array
    {
        return str_contains(strtolower($e->getMessage()), 'email')
            ? ['email' => 'That email is already registered.']
            : ['username' => 'That username is already taken.'];
    }

    // Creates a brand-new user with their info filled in.
    private function saveNew(AccountRequest $request): User
    {
        return User::createWithInfo(
            $request->string('username')->toString(),
            $request->string('password')->toString(),
            $request->string('role')->toString(),
            $request->string('firstName')->toString(),
            $request->string('lastName')->toString(),
            $request->string('email')->toString(),
        );
    }

    // Blocks anyone below super admin from touching admin or super admin accounts.
    private function guardRole(User $actor, ?User $target, ?string $newRole): void
    {
        $protected = ['admin', 'super_admin'];

        if ($target && in_array($target->role, $protected, true) && $actor->role !== 'super_admin') {
            abort(403, 'You do not have access to this.');
        }

        if ($newRole && in_array($newRole, $protected, true) && $actor->role !== 'super_admin') {
            abort(403, 'You do not have access to this.');
        }
    }

    // Stops the last remaining super admin from being demoted or deleted.
    private function guardLastSuper(User $target, ?string $newRole): void
    {
        $removing = $target->role === 'super_admin' && ($newRole === null || $newRole !== 'super_admin');

        if ($removing && User::query()->where('role', 'super_admin')->count() <= 1) {
            abort(409, 'There must be at least one Super Admin.');
        }
    }

    // Blocks deactivating yourself, and blocks disabling the last active super admin.
    private function guardSelfDisable(Request $request, User $target, string $newStatus): void
    {
        if ($newStatus !== 'disabled' || $target->status === 'disabled') {
            return;
        }

        if ($request->user()->user_id === $target->user_id) {
            abort(409, 'You cannot deactivate your own account.');
        }

        if ($target->role === 'super_admin' && $target->status === 'active'
            && User::query()->where('role', 'super_admin')->where('status', 'active')->count() <= 1) {
            abort(409, 'There must be at least one active Super Admin.');
        }
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
