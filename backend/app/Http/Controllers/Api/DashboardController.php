<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\Property;
use App\Services\AvailabilityFreshness;
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

        if (in_array($user->role, ['student', 'landlord'], true)) {
            $column = $user->role === 'student' ? 'student_id' : 'landlord_id';
            $views = DB::table('viewing_requests')->where($column, $user->id)->where('starts_at', '>', now());
            $counts['upcoming_viewings'] = (clone $views)->where('status', 'accepted')->count();
            $counts['pending_viewings'] = (clone $views)->where('status', $user->role === 'student' ? 'proposed' : 'requested')->count();
            $counts['awaiting_reply'] = Inquiry::query()->where($column, $user->id)->whereHas('property', fn ($query) => $query->where('status', '!=', 'suspended'))->whereHas('student', fn ($query) => $query->where('status', 'active'))->whereHas('landlord', fn ($query) => $query->where('status', 'active'))->whereRaw('(select sender_id from inquiry_messages where inquiry_id = inquiries.id order by id desc limit 1) <> ?', [$user->id])->count();
            if ($user->role === 'student') {
                $counts['shortlists'] = DB::table('shortlists')->where('student_id', $user->id)->count();
            } else {
                $counts['stale_listings'] = $user->properties()->where('status', 'approved')->whereHas('roomOptions', fn ($query) => $query->where('availability_confirmed_at', '<=', now()->subDays(AvailabilityFreshness::REMIND_DAYS)))->count();
            }
        } else {
            $counts['older_reviews'] = Property::query()->where('status', 'pending_review')->where('submitted_at', '<', now()->subDays(2))->whereHas('landlord', fn ($query) => $query->where('status', 'active'))->count();
        }

        return response()->json(['data' => $counts]);
    }
}
