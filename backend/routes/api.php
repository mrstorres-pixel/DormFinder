<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\PropertyController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('health', HealthController::class);
    Route::get('media/{photo}', [PhotoController::class, 'local'])->name('photos.local');

    Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::patch('me', [AuthController::class, 'update']);
        Route::patch('me/password', [AuthController::class, 'password']);
        Route::get('landlord/properties', [PropertyController::class, 'index']);
        Route::post('landlord/properties', [PropertyController::class, 'store']);
        Route::get('landlord/properties/{property}', [PropertyController::class, 'show']);
        Route::patch('landlord/properties/{property}', [PropertyController::class, 'update']);
        Route::post('landlord/properties/{property}/photos', [PhotoController::class, 'store'])->middleware('throttle:uploads');
        Route::delete('landlord/properties/{property}/photos/{photo}', [PhotoController::class, 'destroy']);
    });
});
