<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Services\ActivityRecorder;
use App\Services\AdminBrowse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'student', 403);
        $request->validate(['page' => ['nullable', 'integer', 'between:1,100000']]);

        return response()->json(DB::table('listing_reports')->where('student_id', $request->user()->id)
            ->select(['id', 'property_id', 'listing_title', 'category', 'body', 'status', 'created_at', 'resolved_at'])
            ->orderByDesc('id')->paginate(12));
    }

    public function store(Request $request, Property $property, ActivityRecorder $activity): JsonResponse
    {
        abort_unless($request->user()->role === 'student', 403);
        $request->merge(['body' => is_string($request->input('body')) ? trim($request->input('body')) : $request->input('body')]);
        $data = $request->validate(['client_id' => ['required', 'uuid'], 'category' => ['required', Rule::in(['misleading', 'inappropriate', 'duplicate', 'unavailable', 'other'])], 'body' => ['required', 'string', 'min:10', 'max:2000']]);
        $id = DB::transaction(function () use ($request, $property, $data, $activity): int {
            DB::select('select pg_advisory_xact_lock(hashtextextended(?, 0))', ['report-student:'.$request->user()->id]);
            $locked = Property::query()->lockForUpdate()->findOrFail($property->id);
            $existing = DB::table('listing_reports')->where('student_id', $request->user()->id)->where('client_id', $data['client_id'])->first();
            if ($existing) {
                abort_unless($existing->property_id === $locked->id && $existing->category === $data['category'] && $existing->body === $data['body'], 409);

                return $existing->id;
            }
            abort_unless($locked->status === 'approved' && $locked->landlord->status === 'active', 404);
            abort_unless(ListingController::publicQuery()->whereKey($locked->id)->exists(), 404);
            abort_if(DB::table('listing_reports')->where('student_id', $request->user()->id)->where('property_id', $locked->id)->where('status', 'open')->exists(), 409, 'You already have an open report for this listing.');
            $id = DB::table('listing_reports')->insertGetId(['student_id' => $request->user()->id, 'property_id' => $locked->id, 'listing_title' => $locked->title, 'client_id' => $data['client_id'], 'category' => $data['category'], 'body' => $data['body'], 'created_at' => now(), 'updated_at' => now()]);
            foreach (DB::table('users')->where('role', 'admin')->where('status', 'active')->pluck('id') as $admin) {
                $activity->notify($admin, 'report:'.$id, 'listing_report', 'A listing report needs review.', '/admin/reports');
            }

            return $id;
        });

        return response()->json(['data' => ['id' => $id, 'status' => DB::table('listing_reports')->where('id', $id)->value('status')]], 201);
    }

    public function queue(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = AdminBrowse::filters($request, ['status' => ['nullable', Rule::in(['all', 'open', 'resolved', 'dismissed'])], 'category' => ['nullable', Rule::in(['misleading', 'inappropriate', 'duplicate', 'unavailable', 'other'])], 'sort' => ['nullable', Rule::in(['oldest', 'newest'])]]);
        $query = DB::table('listing_reports')->leftJoin('users as reporter', 'reporter.id', '=', 'listing_reports.student_id')->select(['listing_reports.*', 'reporter.name as student_name']);
        if (($data['status'] ?? 'open') !== 'all') {
            $query->where('listing_reports.status', $data['status'] ?? 'open');
        }
        if (filled($data['category'] ?? null)) {
            $query->where('category', $data['category']);
        }
        if (filled($data['q'] ?? null)) {
            $pattern = AdminBrowse::pattern($data['q']);
            $query->where(fn ($query) => $query->whereRaw('lower(listing_title) LIKE ?', [$pattern])->orWhereRaw('lower(body) LIKE ?', [$pattern])->orWhereRaw('lower(reporter.name) LIKE ?', [$pattern]));
        }

        return response()->json($query->orderBy('listing_reports.id', ($data['sort'] ?? 'oldest') === 'newest' ? 'desc' : 'asc')->paginate($data['per_page'] ?? 12)->withQueryString());
    }

    public function resolve(Request $request, int $report, ActivityRecorder $activity): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $request->merge(['reason' => is_string($request->input('reason')) ? trim($request->input('reason')) : $request->input('reason')]);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1'], 'status' => ['required', Rule::in(['resolved', 'dismissed'])], 'reason' => ['required', 'string', 'min:10', 'max:2000']]);
        DB::transaction(function () use ($request, $report, $data, $activity): void {
            $row = DB::table('listing_reports')->where('id', $report)->lockForUpdate()->first();
            abort_unless($row, 404);
            abort_unless($row->status === 'open' && $row->revision === $data['revision'], 409);
            DB::table('listing_reports')->where('id', $report)->update(['status' => $data['status'], 'revision' => $row->revision + 1, 'administrator_id' => $request->user()->id, 'resolution_reason' => $data['reason'], 'resolved_at' => now(), 'updated_at' => now()]);
            $activity->audit($request->user()->id, 'report_closed', 'open', $data['status'], $row->revision + 1, $data['reason'], $row->property_id, report: $row->id);
            $activity->notify($row->student_id, 'report-closed:'.$row->id, 'report_closed', 'Your listing report was '.$data['status'].'.', '/reports');
        });

        return response()->json(['data' => ['id' => $report, 'status' => $data['status']]]);
    }
}
