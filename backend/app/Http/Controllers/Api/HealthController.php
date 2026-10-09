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
            abort_unless(DB::table('migrations')->where('migration', '2026_10_09_090053_create_phase_two_workflow_tables')->exists(), 503);
        } catch (\Throwable) {
            abort(503);
        }

        return response()->json(['data' => ['status' => 'ready', 'service' => 'DormFinder API', 'phase' => 2]]);
    }
}
