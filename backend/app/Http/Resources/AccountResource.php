<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountResource extends JsonResource
{
    // Shapes a user and their info into the camelCase JSON the app expects.
    public function toArray(Request $request): array
    {
        $info = $this->info;

        return [
            'userId' => $this->user_id,
            'username' => $this->username,
            'role' => $this->role,
            'status' => $this->status ?? 'active',
            'info' => $info ? [
                'userinfoId' => $info->userinfo_id,
                'userId' => $info->user_id,
                'firstName' => $info->first_name,
                'lastName' => $info->last_name,
                'email' => $info->email,
                'profilePhotoUrl' => $info->profile_photo_url,
                'createdAt' => $info->created_at?->toIso8601String(),
            ] : null,
        ];
    }
}
