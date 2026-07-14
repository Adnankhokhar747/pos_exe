<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\TenantCloudBackup;
use App\Services\BackupService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DailyCloudBackupCommand extends Command
{
    protected $signature   = 'backup:daily-cloud {--tenant= : Run for a specific tenant ID only}';
    protected $description = 'Daily auto-backup for all tenants that have cloud backup enabled.';

    public function __construct(private BackupService $backup)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $specificId = $this->option('tenant');

        // All tenants with cloud backup enabled
        $query = TenantCloudBackup::where('enabled', true)
            ->with('tenant');

        if ($specificId) {
            $query->where('tenant_id', $specificId);
        }

        $settings = $query->get();

        if ($settings->isEmpty()) {
            $this->info('No tenants with cloud backup enabled.');
            return 0;
        }

        $succeeded = 0;
        $failed    = 0;

        foreach ($settings as $setting) {
            $tenant = $setting->tenant;
            if (!$tenant) continue;

            try {
                $this->line("  Backing up: {$tenant->name}");

                // 1. Export data
                $data = $this->backup->export($tenant->id);
                $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

                // 2. Save to file: storage/app/backup/{Company Name}/{Company Name}_2026-07-14_08-30.json
                $safeName = preg_replace('/[^\w\- ]/', '_', $tenant->name);
                $timestamp = now()->format('Y-m-d_H-i');
                $relativePath = "backup/{$safeName}/{$safeName}_{$timestamp}.json";

                Storage::disk('local')->put($relativePath, $json);

                // 3. Prune old backup files — keep last 30 days
                $this->pruneOldFiles("backup/{$safeName}", 30);

                // 4. Store as DB snapshot (so it's visible in the portal)
                $label = $tenant->name . ' — auto ' . now()->format('Y-m-d H:i');
                $this->backup->createSnapshot($tenant->id, $label);

                // 5. Update last_backed_up_at
                $setting->update(['last_backed_up_at' => now()]);

                $this->info("  ✓ {$tenant->name} → {$relativePath}");
                $succeeded++;
            } catch (\Throwable $e) {
                $this->error("  ✗ {$tenant->name}: {$e->getMessage()}");
                Log::error("DailyCloudBackup failed for tenant {$tenant->id}", [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                $failed++;
            }
        }

        $this->info("Done — {$succeeded} succeeded, {$failed} failed.");
        return $failed > 0 ? 1 : 0;
    }

    private function pruneOldFiles(string $directory, int $keepDays): void
    {
        if (!Storage::disk('local')->exists($directory)) return;

        $cutoff = now()->subDays($keepDays)->getTimestamp();
        $files  = Storage::disk('local')->files($directory);

        foreach ($files as $file) {
            $lastModified = Storage::disk('local')->lastModified($file);
            if ($lastModified < $cutoff) {
                Storage::disk('local')->delete($file);
            }
        }
    }
}
