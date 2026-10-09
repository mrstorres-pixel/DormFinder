<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;

class DemoRoomImage
{
    public function create(int $index, int $view, string $name): UploadedFile
    {
        $image = imagecreatetruecolor(1200, 800);
        $background = imagecolorallocate($image, 248, 247, 240);
        $ink = imagecolorallocate($image, 35, 65, 63);
        $muted = imagecolorallocate($image, 98, 115, 111);
        $accent = imagecolorallocate($image, 62 + ($index * 17 % 120), 120 + ($index * 7 % 65), 120 + ($index * 11 % 75));
        $light = imagecolorallocate($image, 226, 234, 223);
        $white = imagecolorallocate($image, 255, 255, 255);
        $wood = imagecolorallocate($image, 200, 169, 120);
        imagefill($image, 0, 0, $background);
        imagefilledrectangle($image, 0, 0, 1199, 110, $ink);
        imagestring($image, 5, 45, 32, 'DORMFINDER / SAMPLE LISTING', $white);
        imagestring($image, 5, 45, 64, $name, $white);
        imagestring($image, 5, 50, 145, $view === 0 ? 'Illustrative room layout' : 'Illustrative study and shared space', $ink);
        imagefilledrectangle($image, 75, 215, 1125, 675, $light);
        imagesetthickness($image, 7);
        imagerectangle($image, 75, 215, 1125, 675, $ink);
        for ($i = 0; $i < ($view === 0 ? 2 + $index % 3 : 3); $i++) {
            $x = 130 + $i * 225;
            imagefilledrectangle($image, $x, 280, $x + 160, $view === 0 ? 535 : 420, $accent);
            imagefilledrectangle($image, $x + 12, 293, $x + 148, $view === 0 ? 345 : 360, $white);
            imagestring($image, 5, $x + 45, $view === 0 ? 555 : 440, $view === 0 ? 'BED' : 'DESK', $ink);
        }
        imagefilledrectangle($image, 940, 275, 1060, 430, $wood);
        imagestring($image, 5, 950, 450, 'STORAGE', $ink);
        imagefilledrectangle($image, 380, 205, 610, 223, $accent);
        imagestring($image, 4, 400, 238, 'WINDOW', $muted);
        imagestring($image, 5, 50, 720, 'FICTIONAL DEMO - NOT A REAL ROOM OR RENTAL OFFER', $ink);
        imagestring($image, 4, 50, 750, 'Layout illustration only. Photo gallery and private image storage demonstration.', $muted);
        $path = tempnam(sys_get_temp_dir(), 'dormfinder-demo-');
        if ($path === false || ! imagepng($image, $path)) {
            throw new \RuntimeException('Demo image could not be created.');
        }

        return new UploadedFile($path, 'sample-layout.png', 'image/png', null, true);
    }
}
