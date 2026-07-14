<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_cloud_backup_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->boolean('enabled')->default(false);
            $table->boolean('auto_backup')->default(true);
            $table->integer('max_snapshots')->default(10);
            $table->timestamp('last_backed_up_at')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('tenant_backup_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->integer('version');
            $table->string('label')->nullable();
            $table->json('snapshot_data');
            $table->integer('size_bytes')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'version']);
            $table->index(['tenant_id', 'created_at']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_backup_snapshots');
        Schema::dropIfExists('tenant_cloud_backup_settings');
    }
};

