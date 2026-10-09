<?php

namespace App\Services;

use App\Models\Property;
use App\Models\PropertyPhoto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PhotoStorage
{
    /** @param array{upload_id: string, revision: int, caption?: ?string} $data */
    public function upload(Property $property, UploadedFile $file, array $data): PropertyPhoto
    {
        $bytes = $this->normalize($file);
        $photo = DB::transaction(function () use ($property, $data): PropertyPhoto {
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            Gate::authorize('update', $locked);
            $existing = $locked->photos()->where('upload_id', $data['upload_id'])->first();
            if ($existing) {
                abort_unless($existing->status === 'ready', 409);

                return $existing;
            }
            abort_unless($locked->revision === (int) $data['revision'], 409);
            if ($locked->photos()->whereIn('status', ['uploading', 'ready'])->count() >= config('dormfinder.max_photos')) {
                throw ValidationException::withMessages(['photo' => 'A property can have up to eight photos.']);
            }
            $photo = $locked->photos()->create([
                'upload_id' => $data['upload_id'],
                'disk' => config('filesystems.default'),
                'storage_key' => 'properties/'.$locked->id.'/'.Str::uuid().'.jpg',
                'caption' => $data['caption'] ?? 'Property photo',
                'status' => 'uploading',
                'sort_order' => (int) $locked->photos()->max('sort_order') + 1,
            ]);
            $locked->status = 'draft';
            $locked->approved_at = null;
            $locked->revision++;
            $locked->save();

            return $photo;
        });

        if ($photo->status === 'ready') {
            return $photo;
        }

        try {
            $written = Storage::disk($photo->disk)->put($photo->storage_key, $bytes, [
                'ContentType' => 'image/jpeg', 'CacheControl' => 'private, no-store',
            ]);
            if (! $written) {
                throw new \RuntimeException('Storage write failed.');
            }
            $photo->update(['status' => 'ready']);
        } catch (\Throwable) {
            $photo->update(['status' => 'pending_deletion']);
            $this->delete($photo);
            Log::warning('Photo upload failed', ['photo_id' => $photo->id]);
            abort(503);
        }

        return $photo;
    }

    public function url(PropertyPhoto $photo): string
    {
        $expires = now()->addMinutes(config('dormfinder.signed_url_minutes'));
        if ($photo->disk === 'local') {
            return URL::temporarySignedRoute('photos.local', $expires, ['photo' => $photo->id], absolute: false);
        }

        return Storage::disk($photo->disk)->temporaryUrl($photo->storage_key, $expires);
    }

    public function delete(PropertyPhoto $photo): bool
    {
        try {
            if (! Storage::disk($photo->disk)->delete($photo->storage_key)) {
                return false;
            }
            $photo->delete();

            return true;
        } catch (\Throwable) {
            Log::warning('Photo deletion pending', ['photo_id' => $photo->id]);

            return false;
        }
    }

    private function normalize(UploadedFile $file): string
    {
        $size = @getimagesize($file->getRealPath());
        if (! $size || ! in_array($size[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)
            || $size[0] * $size[1] > 12_000_000) {
            throw ValidationException::withMessages(['photo' => 'Use a valid JPEG, PNG or WebP image of at most 12 megapixels.']);
        }
        $source = @imagecreatefromstring($file->getContent());
        if (! $source) {
            throw ValidationException::withMessages(['photo' => 'This image could not be decoded.']);
        }
        if ($size[2] === IMAGETYPE_JPEG) {
            $metadata = @exif_read_data($file->getRealPath()) ?: [];
            $orientation = (int) ($metadata['Orientation'] ?? 1);
            if (in_array($orientation, [2, 4, 5, 7], true)) {
                imageflip($source, IMG_FLIP_HORIZONTAL);
            }
            $degrees = match ($orientation) {
                3, 4 => 180, 5, 6 => -90, 7, 8 => 90, default => 0
            };
            if ($degrees !== 0) {
                $source = imagerotate($source, $degrees, 0);
            }
        }
        $width = imagesx($source);
        $height = imagesy($source);
        $scale = min(1, 1600 / max($width, $height));
        $target = imagecreatetruecolor(max(1, (int) round($width * $scale)), max(1, (int) round($height * $scale)));
        imagefill($target, 0, 0, imagecolorallocate($target, 255, 255, 255));
        imagecopyresampled($target, $source, 0, 0, 0, 0, imagesx($target), imagesy($target), $width, $height);
        ob_start();
        imagejpeg($target, null, 82);

        return (string) ob_get_clean();
    }
}
