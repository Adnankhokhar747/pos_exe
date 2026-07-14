<?php

namespace App\Http\Controllers\Backup;

use App\Http\Controllers\Controller;
use App\Models\TenantBackupSnapshot;
use App\Services\BackupService;
use Illuminate\Http\Request;

class BackupController extends Controller
{
    public function __construct(private BackupService $backup) {}

    /** GET /api/v1/backup/status */
    public function status(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $settings = $this->backup->getSettings($tenantId);
        $count    = TenantBackupSnapshot::where('tenant_id', $tenantId)->count();
        $latest   = TenantBackupSnapshot::where('tenant_id', $tenantId)->orderByDesc('version')->first();

        return response()->json([
            'enabled'         => $settings->enabled,
            'autoBackup'      => $settings->auto_backup,
            'maxSnapshots'    => $settings->max_snapshots,
            'lastBackedUpAt'  => $settings->last_backed_up_at?->toISOString(),
            'snapshotCount'   => $count,
            'latestSnapshot'  => $latest ? [
                'id'        => $latest->id,
                'version'   => $latest->version,
                'label'     => $latest->label,
                'sizeBytes' => $latest->size_bytes,
                'createdAt' => $latest->created_at->toISOString(),
            ] : null,
        ]);
    }

    /** POST /api/v1/backup/create */
    public function create(Request $request)
    {
        $request->validate([
            'label' => 'nullable|string|max:100',
        ]);

        $tenantId = $request->user()->tenant_id;
        $snapshot = $this->backup->createSnapshot($tenantId, $request->label);

        return response()->json([
            'id'        => $snapshot->id,
            'version'   => $snapshot->version,
            'label'     => $snapshot->label,
            'sizeBytes' => $snapshot->size_bytes,
            'createdAt' => $snapshot->created_at->toISOString(),
        ], 201);
    }

    /** GET /api/v1/backup/snapshots */
    public function snapshots(Request $request)
    {
        $tenantId  = $request->user()->tenant_id;
        $snapshots = TenantBackupSnapshot::where('tenant_id', $tenantId)
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

    /** GET /api/v1/backup/snapshots/{id}/download */
    public function download(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $snapshot = TenantBackupSnapshot::where('tenant_id', $tenantId)->findOrFail($id);

        $json     = json_encode($snapshot->snapshot_data, JSON_PRETTY_PRINT);
        $filename = 'backup-v' . $snapshot->version . '-' . now()->format('Ymd') . '.json';

        return response($json, 200, [
            'Content-Type'        => 'application/json',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /** POST /api/v1/backup/snapshots/{id}/restore */
    public function restore(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $snapshot = TenantBackupSnapshot::where('tenant_id', $tenantId)->findOrFail($id);

        $this->backup->restore($tenantId, $snapshot->snapshot_data);

        return response()->json(['message' => 'Restore completed successfully.']);
    }

    /** POST /api/v1/backup/import  — upload a JSON backup file */
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:json|max:102400', // 100 MB max
        ]);

        $tenantId = $request->user()->tenant_id;
        $raw      = file_get_contents($request->file('file')->getRealPath());
        $data     = json_decode($raw, true);

        if (!$data || !isset($data['tables'])) {
            return response()->json(['message' => 'Invalid backup file format.'], 422);
        }

        if (($data['version'] ?? 0) < 2) {
            return response()->json(['message' => 'Unsupported backup version. Please use a backup created with the current version of the app.'], 422);
        }

        $this->backup->restore($tenantId, $data);

        // Store an imported snapshot
        $json = json_encode($data);
        $nextVersion = (TenantBackupSnapshot::where('tenant_id', $tenantId)->max('version') ?? 0) + 1;
        TenantBackupSnapshot::create([
            'tenant_id'     => $tenantId,
            'version'       => $nextVersion,
            'label'         => 'Imported backup ' . now()->format('Y-m-d'),
            'snapshot_data' => $data,
            'size_bytes'    => strlen($json),
        ]);

        return response()->json(['message' => 'Import and restore completed successfully.']);
    }

    /**
     * GET /api/v1/backup/export
     * Local backup — streams the full tenant data as a JSON file download.
     * Does NOT store a server snapshot (free, no quota consumed).
     */
    public function export(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $data     = $this->backup->export($tenantId);
        $json     = json_encode($data, JSON_PRETTY_PRINT);
        $filename = 'local-backup-' . now()->format('Ymd-His') . '.json';

        return response($json, 200, [
            'Content-Type'        => 'application/json',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /** DELETE /api/v1/backup/snapshots/{id} */
    public function deleteSnapshot(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;
        $snapshot = TenantBackupSnapshot::where('tenant_id', $tenantId)->findOrFail($id);
        $snapshot->delete();

        return response()->json(['message' => 'Snapshot deleted.']);
    }
}
