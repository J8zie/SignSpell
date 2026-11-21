<?php

namespace Tests\Fakes;

use App\Services\ImageStore;
use Illuminate\Http\UploadedFile;
use RuntimeException;

class FakeImageStore implements ImageStore
{
    public array $deleted = [];

    public int $uploads = 0;

    public int $failOnUpload = 0;

    /** When true, every delete throws, like a storage outage. */
    public bool $failDeletes = false;

    public function upload(mixed $file, string $folder): array
    {
        $this->uploads++;

        if ($this->failOnUpload > 0 && $this->uploads === $this->failOnUpload) {
            throw new RuntimeException('Upload failed.');
        }

        $name = $file instanceof UploadedFile ? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) : 'file';
        $mime = $file instanceof UploadedFile ? (string) $file->getMimeType() : 'image/jpeg';
        $kind = str_starts_with($mime, 'video/') ? 'video' : 'image';
        $publicId = $folder.'/'.$name.'-'.$this->uploads;

        $url = $kind === 'image'
            ? 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/'.$publicId
            : 'https://res.cloudinary.com/demo/video/upload/'.$publicId;

        return [
            'url' => $url,
            'public_id' => $publicId,
        ];
    }

    public function delete(?string $publicId, string $resourceType = 'image'): void
    {
        if ($this->failDeletes) {
            throw new RuntimeException('Storage is down.');
        }

        if ($publicId) {
            $this->deleted[] = $publicId;
        }
    }
}
