<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MediaResource extends JsonResource
{
    // Shapes one sign media file into the camelCase JSON the app expects.
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->media_id,
            'type' => $this->type,
            'name' => $this->name,
            'url' => $this->url,
            'sequence' => $this->sequence,
        ];
    }
}
