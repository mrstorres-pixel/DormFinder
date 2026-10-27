<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campus;
use App\Services\ActivityRecorder;
use App\Services\AdminBrowse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CampusManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->administrator($request);
        $data = AdminBrowse::filters($request, ['active' => ['nullable', Rule::in(['active', 'inactive'])], 'sort' => ['nullable', Rule::in(['name', 'newest', 'updated'])]]);
        $query = Campus::query();
        if (filled($data['active'] ?? null)) {
            $query->where('active', $data['active'] === 'active');
        }
        if (filled($data['q'] ?? null)) {
            $pattern = AdminBrowse::pattern($data['q']);
            $query->where(function ($query) use ($pattern): void {
                $query->whereRaw('lower(name) LIKE ?', [$pattern])->orWhereRaw('lower(coalesce(institution_name, ?)) LIKE ?', ['', $pattern])->orWhereRaw('lower(coalesce(city, ?)) LIKE ?', ['', $pattern])->orWhereRaw('lower(address) LIKE ?', [$pattern])->orWhereRaw('lower(aliases::text) LIKE ?', [$pattern]);
            });
        }
        match ($data['sort'] ?? 'name') {
            'name' => $query->orderBy('name'),
            'updated' => $query->orderByDesc('updated_at'),
            default => $query->orderByDesc('id'),
        };
        $page = $query->orderBy('id')->paginate($data['per_page'] ?? 12)->withQueryString()->toArray();

        return response()->json(['data' => $page['data'], 'meta' => array_diff_key($page, array_flip(['data', 'links'])), 'pending_suggestions' => DB::table('campus_suggestions')->where('status', 'pending')->count()]);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->save($request);
    }

    public function show(Request $request, Campus $campus): JsonResponse
    {
        $this->administrator($request);

        return response()->json(['data' => $campus]);
    }

    public function update(Request $request, Campus $campus): JsonResponse
    {
        return $this->save($request, $campus);
    }

    private function save(Request $request, ?Campus $campus = null): JsonResponse
    {
        $this->administrator($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'], 'institution_name' => ['required', 'string', 'max:180'], 'city' => ['required', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:255'], 'latitude' => ['required', 'numeric', 'between:4,22'], 'longitude' => ['required', 'numeric', 'between:116,127.5'],
            'source_url' => ['required', 'url:http,https', 'max:255'], 'reference_note' => ['required', 'string', 'min:5', 'max:255'],
            'aliases' => ['present', 'array', 'max:12'], 'aliases.*' => ['required', 'string', 'max:80'], 'verified' => ['accepted'],
            'revision' => [$campus ? 'required' : 'nullable', 'integer', 'min:1'],
            'suggestion_id' => ['nullable', 'integer'], 'suggestion_revision' => ['required_with:suggestion_id', 'integer', 'min:1'],
        ]);
        $saved = DB::transaction(function () use ($request, $campus, $data): Campus {
            DB::select('select pg_advisory_xact_lock(871037)');
            $locked = $campus ? Campus::query()->lockForUpdate()->findOrFail($campus->id) : new Campus;
            abort_if($campus && $locked->revision !== $data['revision'], 409, 'This campus changed. Reload its saved details before trying again.');
            $duplicate = Campus::query()->whereRaw('lower(name) = ?', [mb_strtolower(trim($data['name']))])->whereRaw('lower(city) = ?', [mb_strtolower(trim($data['city']))]);
            if ($campus) {
                $duplicate->where('id', '!=', $campus->id);
            }
            if ($duplicate->exists()) {
                throw ValidationException::withMessages(['name' => 'This campus and city are already in the directory. Edit the existing campus instead.']);
            }
            $before = $locked->exists ? $locked->only(['name', 'institution_name', 'city', 'address', 'latitude', 'longitude', 'source_url', 'reference_note', 'aliases']) : [];
            $values = array_intersect_key($data, array_flip(['name', 'institution_name', 'city', 'address', 'latitude', 'longitude', 'source_url', 'reference_note', 'aliases']));
            foreach ($values as $key => $value) {
                $values[$key] = is_string($value) ? trim($value) : $value;
            }
            $values['aliases'] = array_values(collect($values['aliases'])->map(fn (string $alias): string => trim($alias))->filter()->unique(fn (string $alias): string => mb_strtolower($alias))->all());
            $locked->forceFill($values);
            if (! $campus) {
                $locked->slug = Str::limit(Str::slug($values['name'].'-'.$values['city']), 65, '').'-'.Str::lower(Str::random(8));
                $locked->active = true;
            }
            $locked->revision = $campus ? $locked->revision + 1 : 1;
            $locked->save();
            $this->record($request, $locked, $campus ? 'updated' : 'created', ['before' => $before, 'after' => $locked->only(array_keys($values))]);
            if (isset($data['suggestion_id'])) {
                $this->resolveLocked($request, $data['suggestion_id'], $data['suggestion_revision'], 'added', 'The campus has been verified and added to the directory.', $locked->id);
            }

            return $locked;
        });

        return response()->json(['data' => $saved], $campus ? 200 : 201);
    }

    public function visibility(Request $request, Campus $campus): JsonResponse
    {
        $this->administrator($request);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1'], 'active' => ['required', 'boolean'], 'confirmed' => ['accepted']]);
        $saved = DB::transaction(function () use ($request, $campus, $data): Campus {
            DB::select('select pg_advisory_xact_lock(871037)');
            $locked = Campus::query()->lockForUpdate()->findOrFail($campus->id);
            abort_unless($locked->revision === $data['revision'], 409, 'This campus changed. Reload before changing its visibility.');
            $before = $locked->active;
            $locked->active = $data['active'];
            $locked->revision++;
            $locked->save();
            $this->record($request, $locked, $locked->active ? 'activated' : 'deactivated', ['before' => ['active' => $before], 'after' => ['active' => $locked->active]]);

            return $locked;
        });

        return response()->json(['data' => $saved]);
    }

    public function history(Request $request, Campus $campus): JsonResponse
    {
        $this->administrator($request);
        $request->validate(['page' => ['nullable', 'integer', 'between:1,100000']]);
        $rows = DB::table('campus_actions')->join('users', 'users.id', '=', 'campus_actions.actor_id')->where('campus_id', $campus->id)->select('campus_actions.*', 'users.name as actor_name')->orderByDesc('campus_actions.id')->paginate(12);

        return response()->json($rows);
    }

    public function suggest(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['student', 'landlord'], true), 403);
        $data = $request->validate(['client_id' => ['required', 'uuid'], 'name' => ['required', 'string', 'min:3', 'max:150'], 'city' => ['required', 'string', 'min:2', 'max:100'], 'address' => ['required', 'string', 'min:5', 'max:255'], 'source_url' => ['nullable', 'url:http,https', 'max:255']]);
        foreach (['name', 'city', 'address'] as $field) {
            $data[$field] = trim($data[$field]);
        }
        $result = DB::transaction(function () use ($request, $data) {
            DB::select('select pg_advisory_xact_lock(871038)');
            $existing = DB::table('campus_suggestions')->where('user_id', $request->user()->id)->where('client_id', $data['client_id'])->first();
            if ($existing) {
                foreach (['name', 'city', 'address'] as $key) {
                    abort_unless($existing->{$key} === $data[$key], 409, 'This request was already submitted with different details.');
                }

                return $existing;
            }
            $pending = DB::table('campus_suggestions')->where('user_id', $request->user()->id)->where('status', 'pending')->whereRaw('lower(name) = ?', [mb_strtolower($data['name'])])->whereRaw('lower(city) = ?', [mb_strtolower($data['city'])])->first();
            if ($pending) {
                return $pending;
            }
            $id = DB::table('campus_suggestions')->insertGetId([...$data, 'user_id' => $request->user()->id, 'created_at' => now(), 'updated_at' => now()]);

            return DB::table('campus_suggestions')->find($id);
        });

        return response()->json(['data' => $result], 201);
    }

    public function suggestions(Request $request): JsonResponse
    {
        $admin = $request->user()->role === 'admin';
        abort_if($request->is('api/v1/admin/*') && ! $admin, 403);
        abort_unless($admin || in_array($request->user()->role, ['student', 'landlord'], true), 403);
        $data = AdminBrowse::filters($request, ['status' => ['nullable', Rule::in(['pending', 'added', 'duplicate', 'declined', 'all'])]]);
        $query = DB::table('campus_suggestions')->join('users', 'users.id', '=', 'campus_suggestions.user_id')->select('campus_suggestions.*', 'users.name as requester_name');
        if (! $admin) {
            $query->where('user_id', $request->user()->id);
        }
        if (($data['status'] ?? ($admin ? 'pending' : 'all')) !== 'all') {
            $query->where('campus_suggestions.status', $data['status'] ?? 'pending');
        }
        if (filled($data['q'] ?? null)) {
            $pattern = AdminBrowse::pattern($data['q']);
            $query->where(fn ($query) => $query->whereRaw('lower(campus_suggestions.name) LIKE ?', [$pattern])->orWhereRaw('lower(campus_suggestions.city) LIKE ?', [$pattern]));
        }

        return response()->json($query->orderByDesc('campus_suggestions.id')->paginate($data['per_page'] ?? 12));
    }

    public function resolve(Request $request, int $suggestion): JsonResponse
    {
        $this->administrator($request);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1'], 'status' => ['required', Rule::in(['duplicate', 'declined'])], 'campus_id' => ['required_if:status,duplicate', 'nullable', 'integer', Rule::exists('campuses', 'id')->where('active', true)], 'note' => ['required', 'string', 'min:10', 'max:1000']]);
        DB::transaction(function () use ($request, $suggestion, $data): void {
            DB::select('select pg_advisory_xact_lock(871037)');
            if ($data['status'] === 'duplicate') {
                abort_unless(Campus::query()->whereKey($data['campus_id'])->where('active', true)->exists(), 409);
            }
            $this->resolveLocked($request, $suggestion, $data['revision'], $data['status'], trim($data['note']), $data['status'] === 'duplicate' ? $data['campus_id'] : null);
        });

        return response()->json(['data' => DB::table('campus_suggestions')->find($suggestion)]);
    }

    private function resolveLocked(Request $request, int $id, int $revision, string $status, string $note, ?int $campus): void
    {
        $suggestion = DB::table('campus_suggestions')->lockForUpdate()->find($id);
        abort_unless($suggestion, 404);
        abort_unless($suggestion->status === 'pending' && $suggestion->revision === $revision, 409, 'This suggestion has already changed. Refresh the suggestions.');
        DB::table('campus_suggestions')->where('id', $id)->update(['status' => $status, 'revision' => $revision + 1, 'campus_id' => $campus, 'administrator_id' => $request->user()->id, 'resolution_note' => $note, 'updated_at' => now()]);
        app(ActivityRecorder::class)->notify($suggestion->user_id, 'campus-suggestion:'.$id.':'.($revision + 1), 'campus', $status === 'declined' ? 'Your campus suggestion has feedback.' : 'Your suggested campus is now available in the directory.', $campus ? '/listings?campus_id='.$campus : '/campuses/suggest');
    }

    private function record(Request $request, Campus $campus, string $action, array $changes): void
    {
        DB::table('campus_actions')->insert(['campus_id' => $campus->id, 'actor_id' => $request->user()->id, 'action' => $action, 'revision' => $campus->revision, 'changes' => json_encode($changes, JSON_THROW_ON_ERROR), 'created_at' => now()]);
    }

    private function administrator(Request $request): void
    {
        abort_unless($request->user()->role === 'admin', 403);
    }
}
