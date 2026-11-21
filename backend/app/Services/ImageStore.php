<?php

namespace App\Services;

interface ImageStore
{
    /**
     * Uploads a file and returns its delivery URL and public id.
     *
     * @return array{url: string, public_id: string}
     */
    public function upload(mixed $file, string $folder): array;

    // Deletes a stored file by its public id.
    public function delete(?string $publicId, string $resourceType = 'image'): void;
}
