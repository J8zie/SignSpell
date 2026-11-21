<?php

namespace App\Http\Controllers;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    // Lists audit entries newest-first with optional filters; read-only by design.
    public function index(Request $request)
    {
        validator($request->query(), [
            'q' => ['nullable', 'string', 'max:80'],
            'user' => ['nullable', 'string', 'max:80'],
            'role' => ['nullable', 'in:learner,teacher,admin,super_admin'],
            'action' => ['nullable', 'string', 'max:60'],
            'resource' => ['nullable', 'string', 'max:60'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
        ])->validate();

        $query = AuditLog::query()->orderByDesc('created_at');

        if ($request->filled('q')) {
            $like = '%'.addcslashes(mb_strtolower(trim((string) $request->query('q'))), '%_\\').'%';
            $query->where(function ($inner) use ($like) {
                $inner->whereRaw('lower(coalesce(username, \'\')) like ?', [$like])
                    ->orWhereRaw('lower(coalesce(description, \'\')) like ?', [$like])
                    ->orWhereRaw('lower(coalesce(resource_id, \'\')) like ?', [$like]);
            });
        }
        if ($request->filled('user')) {
            $query->where('username', $request->query('user'));
        }
        if ($request->filled('role')) {
            $query->where('user_role', $request->query('role'));
        }
        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }
        if ($request->filled('resource')) {
            $query->where('resource_type', $request->query('resource'));
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->query('to').' 23:59:59');
        }

        return AuditLogResource::collection($query->paginate(20)->withQueryString());
    }

    // Lists the distinct days (YYYY-MM-DD) that have audit entries, newest first.
    public function dates()
    {
        return AuditLog::query()
            ->selectRaw('date(created_at) as day')
            ->distinct()
            ->orderByDesc('day')
            ->pluck('day');
    }

    // Returns one audit entry with its before/after values.
    public function show(AuditLog $auditLog)
    {
        return new AuditLogResource($auditLog);
    }
}
