<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campus;
use App\Services\WalkingRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WalkingRouteController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request, int $property, WalkingRoute $routing): JsonResponse
    {
        $listing = ListingController::publicQuery()->findOrFail($property);
        $data = $request->validate(['campus_id' => ['required', 'integer', Rule::exists('campuses', 'id')->where('active', true)]]);
        $campus = Campus::query()->findOrFail($data['campus_id']);
        $result = $routing->between($listing, $campus);

        return response()->json($result['body'], $result['status'], [
            'Cache-Control' => 'no-store',
            ...($result['status'] === 429 ? ['Retry-After' => '2'] : []),
        ]);
    }
}
