<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('select 1');
            DB::table('migrations')->limit(1)->first();
        } catch (\Throwable) {
            abort(503);
        }

        return response()->json(['data' => ['status' => 'ready', 'service' => 'DormFinder API']]);
    }
}
