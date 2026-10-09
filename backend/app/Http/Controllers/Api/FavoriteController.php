<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicPropertyResource;
use App\Services\CampusDistance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class FavoriteController extends Controller
{
    private function authorizeStudent(Request $request): int
    {
        abort_unless($request->user()->role === 'student', 403);

        return $request->user()->id;
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $student = $this->authorizeStudent($request);
        $request->validate(['page' => ['nullable', 'integer', 'min:1', 'max:100000']]);
        $query = CampusDistance::annotate(ListingController::publicQuery(), CampusDistance::reference())->with(ListingController::relations())
            ->join('favorites', fn ($join) => $join->on('favorites.property_id', '=', 'properties.id')->where('favorites.student_id', $student))
            ->orderByDesc('favorites.id');

        $unavailable = DB::table('favorites')->where('student_id', $student)->whereNotIn('property_id', ListingController::publicQuery()->select('id'))->orderByDesc('id')->pluck('property_id');

        return PublicPropertyResource::collection($query->paginate(12)->withQueryString())->additional(['meta' => ['unavailable_ids' => $unavailable]]);
    }

    public function ids(Request $request): JsonResponse
    {
        $student = $this->authorizeStudent($request);

        return response()->json(['data' => DB::table('favorites')->where('student_id', $student)->orderByDesc('id')->pluck('property_id')]);
    }

    public function store(Request $request, int $property): JsonResponse
    {
        $student = $this->authorizeStudent($request);
        DB::transaction(function () use ($property, $student): void {
            ListingController::publicQuery()->lockForUpdate()->findOrFail($property);
            DB::table('favorites')->insertOrIgnore(['student_id' => $student, 'property_id' => $property, 'created_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['data' => ['property_id' => $property, 'saved' => true]]);
    }

    public function destroy(Request $request, int $property): JsonResponse
    {
        $student = $this->authorizeStudent($request);
        DB::table('favorites')->where('student_id', $student)->where('property_id', $property)->delete();

        return response()->json(['data' => ['property_id' => $property, 'saved' => false]]);
    }
}
