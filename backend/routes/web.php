<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => 'DormFinder API']));
Route::prefix('api/v1/auth')->group(function (): void {
    Route::post('register/{role}', [AuthController::class, 'register'])
        ->whereIn('role', ['student', 'landlord'])->middleware('throttle:registration');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('logout', [AuthController::class, 'logout'])->middleware(['auth:sanctum', 'active']);
});
