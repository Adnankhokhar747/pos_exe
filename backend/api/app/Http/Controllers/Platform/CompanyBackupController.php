<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantBackupSnapshot;
use App\Services\BackupService;
use Illuminate\Http\Request;

class CompanyBackupController extends Controller
{
    public function __construct(private BackupService $backup) {}

    /** GET /api/v1/platform/companies/{id}/backup */
    public function show(string $id)
    {
        $tenant   = Tenant::findOrFail($id);
        $settings = $this->backup->getSettings($tenant->id);
        $count    = TenantBackupSnapshot::where('tenant_id', $tenant->id)->count();
        $latest   = TenantBackupSnapshot::where('tenant_id', $tenant->id)->orderByDesc('version')->first();

        return response()->json([
            'enabled'        => $settings->enabled,
            'autoBackup'     => $settings->auto_backup,
            'maxSnapshots'   => $settings->max_snapshots,
            'lastBackedUpAt' => $settings->last_backed_up_at?->toISOString(),
            'snapshotCount'  => $count,
            'latestSnapshot' => $latest ? [
                'id'        => $latest->id,
                'version'   => $latest->version,
                'label'     => $latest->label,
                'sizeBytes' => $latest->size_bytes,
                'createdAt' => $latest->created_at->toISOString(),
            ] : null,
        ]);
    }

    /** PATCH /api/v1/platform/companies/{id}/backup */
    public function update(Request $request, string $id)
    {
        $request->validate([
            'enabled'      => 'nullable|boolean',
            'autoBackup'   => 'nullable|boolean',
            'maxSnapshots' => 'nullable|integer|min:1|max:50',
        ]);

        $tenant   = Tenant::findOrFail($id);
        $settings = $this->backup->updateSettings($tenant->id, [
            'enabled'      => $request->has('enabled') ? $request->boolean('enabled') : null,
            'auto_backup'  => $request->has('autoBackup') ? $request->boolean('autoBackup') : null,
            'max_snapshots'=> $request->maxSnapshots,
        ]);

        return response()->json([
            'enabled'      => $settings->enabled,
            'autoBackup'   => $settings->auto_backup,
            'maxSnapshots' => $settings->max_snapshots,
            'lastBackedUpAt' => $settings->last_backed_up_at?->toISOString(),
        ]);
    }

    /** GET /api/v1/platform/companies/{id}/backup/snapshots */
    public function snapshots(string $id)
    {
        $tenant    = Tenant::findOrFail($id);
        $snapshots = TenantBackupSnapshot::where('tenant_id', $tenant->id)
            ->orderByDesc('version')
            ->get(['id', 'version', 'label', 'size_bytes', 'created_at']);

        return response()->json($snapshots->map(fn($s) => [
            'id'        => $s->id,
            'version'   => $s->version,
            'label'     => $s->label,
            'sizeBytes' => $s->size_bytes,
            'createdAt' => $s->created_at->toISOString(),
        ]));
    }

    /** GET /api/v1/platform/companies/{id}/backup/snapshots/{snapshotId}/download */
    public function downloadSnapshot(string $id, string $snapshotId)
    {
        $tenant   = Tenant::findOrFail($id);
        $snapshot = TenantBackupSnapshot::where('tenant_id', $tenant->id)->findOrFail($snapshotId);

        $json     = json_encode($snapshot->snapshot_data, JSON_PRETTY_PRINT);
        $filename = $tenant->name . '-backup-v' . $snapshot->version . '-' . now()->format('Ymd') . '.json';
        $filename = preg_replace('/[^a-zA-Z0-9\-_.]/', '_', $filename);

        return response($json, 200, [
            'Content-Type'        => 'application/json',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /** POST /api/v1/platform/companies/{id}/backup/create */
    public function createSnapshot(string $id)
    {
        $tenant   = Tenant::findOrFail($id);
        $snapshot = $this->backup->createSnapshot($tenant->id, 'Admin backup ' . now()->format('Y-m-d H:i'));

        return response()->json([
            'id'        => $snapshot->id,
            'version'   => $snapshot->version,
            'label'     => $snapshot->label,
            'sizeBytes' => $snapshot->size_bytes,
            'createdAt' => $snapshot->created_at->toISOString(),
        ], 201);
    }
}
