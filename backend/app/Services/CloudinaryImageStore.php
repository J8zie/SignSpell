<?php

namespace App\Services;

use Cloudinary\Cloudinary;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpKernel\Exception\HttpException;

class CloudinaryImageStore implements ImageStore
{
    // Uploads a file to Cloudinary and returns its delivery URL and public id.
    public function upload(mixed $file, string $folder): array
    {
        $credentials = $this->credentials();
        $mime = $file instanceof UploadedFile ? (string) $file->getMimeType() : '';
        $resourceType = str_starts_with($mime, 'video/') ? 'video' : 'image';
        $path = $file instanceof UploadedFile ? $file->getRealPath() : (string) $file;

        $result = $this->client($credentials)->uploadApi()->upload($path, [
            'folder' => $folder,
            'resource_type' => $resourceType,
            'unique_filename' => true,
            'overwrite' => false,
        ]);

        $publicId = (string) ($result['public_id'] ?? '');
        if ($publicId === '') {
            throw new HttpException(503, 'The file could not be stored. Check the Cloudinary credentials and try again.');
        }

        return [
            'url' => $this->deliveryUrl(
                $credentials['cloud_name'],
                $publicId,
                $resourceType,
                (string) ($result['secure_url'] ?? ''),
            ),
            'public_id' => $publicId,
        ];
    }

    // Deletes a file from Cloudinary storage by its public id.
    public function delete(?string $publicId, string $resourceType = 'image'): void
    {
        if ($publicId === null || $publicId === '') {
            return;
        }

        $this->client($this->credentials())->uploadApi()->destroy($publicId, [
            'resource_type' => $resourceType,
            'invalidate' => true,
        ]);
    }

    /** Builds a Cloudinary client from the given credentials.
     *
     * @param  array{cloud_name: string, api_key: string, api_secret: string}  $credentials
     */
    private function client(array $credentials): Cloudinary
    {
        return new Cloudinary([
            'cloud' => [
                'cloud_name' => $credentials['cloud_name'],
                'api_key' => $credentials['api_key'],
                'api_secret' => $credentials['api_secret'],
            ],
            'url' => ['secure' => true],
        ]);
    }

    // Builds a resized delivery URL for images; videos keep Cloudinary's secure URL.
    private function deliveryUrl(string $cloud, string $publicId, string $resourceType, string $secureUrl): string
    {
        if ($resourceType !== 'image' || $cloud === '') {
            return $secureUrl;
        }

        return 'https://res.cloudinary.com/'.$cloud.'/image/upload/f_auto,q_auto,w_800/'.$publicId;
    }

    /** Reads Cloudinary credentials from config, falling back to CLOUDINARY_URL.
     *
     * @return array{cloud_name: string, api_key: string, api_secret: string}
     */
    private function credentials(): array
    {
        $name = $this->clean(config('services.cloudinary.cloud_name'));
        $key = $this->clean(config('services.cloudinary.api_key'));
        $secret = $this->clean(config('services.cloudinary.api_secret'));
        $url = $this->clean(config('services.cloudinary.url'));

        if ($url && (! $name || ! $key || ! $secret)) {
            $parts = parse_url($url) ?: [];
            $name = $name ?: $this->clean($parts['host'] ?? null);
            $key = $key ?: $this->clean(isset($parts['user']) ? rawurldecode((string) $parts['user']) : null);
            $secret = $secret ?: $this->clean(isset($parts['pass']) ? rawurldecode((string) $parts['pass']) : null);
        }

        if (! $name || ! $key || ! $secret) {
            throw new HttpException(503, 'Image storage is not configured. Add your Cloudinary credentials and try again.');
        }

        return [
            'cloud_name' => $name,
            'api_key' => $key,
            'api_secret' => $secret,
        ];
    }

    // Trims a config value and turns empty strings into null.
    private function clean(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value, " \t\n\r\0\x0B\"'");

        return $value === '' ? null : $value;
    }
}
