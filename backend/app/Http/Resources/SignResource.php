<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SignResource extends JsonResource
{
    // Shapes a sign into the camelCase JSON the app expects, including the owner's name.
    public function toArray(Request $request): array
    {
        $owner = $this->owner;
        $ownerName = null;

        if ($owner) {
            $info = $owner->info;
            $ownerName = trim(((string) ($info->first_name ?? '')).' '.((string) ($info->last_name ?? '')));
            if ($ownerName === '') {
                $ownerName = $owner->username;
            }
        }

        return [
            'signId' => $this->sign_id,
            'signType' => $this->sign_type,
            'imageUrl' => $this->image_url,
            'label' => $this->label,
            'createdAt' => $this->created_at?->toIso8601String(),
            'userOwnershipId' => $this->userownership_id,
            'ownerName' => $ownerName,
        ];
    }
}
