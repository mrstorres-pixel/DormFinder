<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AvailabilityFreshness;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function unreadCount(Request $request): JsonResponse
    {
        app(AvailabilityFreshness::class)->remind($request->user());

        return response()->json(['data' => ['unread_count' => DB::table('user_notifications')->where('recipient_id', $request->user()->id)->whereNull('read_at')->count()]]);
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate(['page' => ['nullable', 'integer', 'between:1,100000']]);
        app(AvailabilityFreshness::class)->remind($request->user());

        return response()->json(DB::table('user_notifications')->where('recipient_id', $request->user()->id)
            ->select(['id', 'kind', 'title', 'path', 'read_at', 'created_at'])->orderByDesc('id')->paginate(20));
    }

    public function read(Request $request, int $notification): JsonResponse
    {
        $row = DB::table('user_notifications')->where('recipient_id', $request->user()->id)->where('id', $notification)->first();
        abort_unless($row, 404);
        DB::table('user_notifications')->where('id', $row->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['data' => ['id' => $row->id]]);
    }
}
