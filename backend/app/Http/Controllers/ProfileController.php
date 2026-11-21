<?php

namespace App\Http\Controllers;

use App\Http\Requests\PasswordRequest;
use App\Http\Requests\ProfileRequest;
use App\Http\Resources\AccountResource;
use App\Services\Audit;
use App\Services\ImageStore;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProfileController extends Controller
{
    // Updates the user's profile info and optional profile photo.
    public function update(ProfileRequest $request, ImageStore $images)
    {
        $user = $request->user();
        $info = $user->info;
        $stored = null;

        if ($request->hasFile('photo')) {
            $stored = $images->upload($request->file('photo'), 'profiles');
        }

        $previous = $info->profile_photo_public_id;
        $info->first_name = $request->string('firstName')->toString();
        $info->last_name = $request->string('lastName')->toString();
        $info->email = $request->string('email')->toString();

        if ($stored) {
            $info->profile_photo_url = $stored['url'];
            $info->profile_photo_public_id = $stored['public_id'];
        }

        try {
            $info->save();
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

        // Sign lists show the owner's name, so the cache must be refreshed.
        SignController::forgetSignsCache();

        Audit::record($user, Audit::PROFILE_UPDATE, $request, 'user', $user->user_id, 'Updated profile.');

        return new AccountResource($user->load('info'));
    }

    // Changes the password after checking the current one and signs out other devices.
    public function password(PasswordRequest $request)
    {
        $user = $request->user();

        if (! Hash::check($request->string('currentPassword')->toString(), $user->password)) {
            throw ValidationException::withMessages([
                'currentPassword' => 'The current password is not correct.',
            ]);
        }

        $user->password = $request->string('newPassword')->toString();
        $user->save();

        // Every other device is signed out; this one stays signed in.
        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current && isset($current->id), fn ($q) => $q->where('id', '!=', $current->id))
            ->delete();

        Audit::record($user, Audit::PASSWORD_CHANGE, $request, 'user', $user->user_id, 'Changed password.');

        return response()->noContent();
    }
}
