<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\InquiryController;
use App\Http\Controllers\Api\ListingController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\RoomOptionController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('health', HealthController::class);
    Route::get('listings', [ListingController::class, 'index'])->middleware('throttle:api');
    Route::get('listings/{property}', [ListingController::class, 'show'])->whereNumber('property')->middleware('throttle:api');
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
        Route::post('landlord/properties/{property}/room-options', [RoomOptionController::class, 'store']);
        Route::patch('landlord/properties/{property}/room-options/{roomOption}', [RoomOptionController::class, 'update']);
        Route::delete('landlord/properties/{property}/room-options/{roomOption}', [RoomOptionController::class, 'destroy']);
        Route::post('landlord/properties/{property}/submit', [ReviewController::class, 'submit']);
        Route::get('admin/reviews', [ReviewController::class, 'index']);
        Route::get('admin/reviews/{property}', [ReviewController::class, 'show']);
        Route::post('admin/reviews/{property}/decision', [ReviewController::class, 'decide']);
        Route::post('compare', [ListingController::class, 'compare']);
        Route::get('inquiries', [InquiryController::class, 'index']);
        Route::post('listings/{property}/inquiries', [InquiryController::class, 'store'])->middleware('throttle:messages');
        Route::get('inquiries/{inquiry}', [InquiryController::class, 'show']);
        Route::get('inquiries/{inquiry}/messages', [InquiryController::class, 'messages']);
        Route::post('inquiries/{inquiry}/messages', [InquiryController::class, 'reply'])->middleware('throttle:messages');
    });
});
