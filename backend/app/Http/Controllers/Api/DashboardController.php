<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $counts = ['unread_notifications' => DB::table('user_notifications')->where('recipient_id', $user->id)->whereNull('read_at')->count()];
        if ($user->role === 'admin') {
            $counts += [
                'pending_reviews' => Property::query()->where('status', 'pending_review')->whereHas('landlord', fn ($query) => $query->where('status', 'active'))->count(),
                'open_reports' => DB::table('listing_reports')->where('status', 'open')->count(),
                'published_listings' => ListingController::publicQuery()->count(),
                'active_students' => DB::table('users')->where('role', 'student')->where('status', 'active')->count(),
                'active_landlords' => DB::table('users')->where('role', 'landlord')->where('status', 'active')->count(),
                'suspended_accounts' => DB::table('users')->whereIn('role', ['student', 'landlord'])->where('status', 'suspended')->count(),
            ];
        } elseif ($user->role === 'landlord') {
            $counts['listings'] = $user->properties()->select('status')->selectRaw('count(*) AS total')->groupBy('status')->pluck('total', 'status');
            $counts['inquiries'] = Inquiry::query()->where('landlord_id', $user->id)->count();
        } else {
            $counts['favorites'] = DB::table('favorites')->where('student_id', $user->id)->count();
            $counts['inquiries'] = Inquiry::query()->where('student_id', $user->id)->count();
            $counts['open_reports'] = DB::table('listing_reports')->where('student_id', $user->id)->where('status', 'open')->count();
        }

        return response()->json(['data' => $counts]);
    }
}
