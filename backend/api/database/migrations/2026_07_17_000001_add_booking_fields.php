<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add max_daily_appointments to doctors table
        Schema::table('doctors', function (Blueprint $table) {
            $table->integer('max_daily_appointments')->default(30)->after('is_active');
        });

        // 2. Create patient_accounts table
        Schema::create('patient_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id', 36)->index();
            $table->uuid('patient_id')->nullable();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('phone')->nullable();
            $table->string('remember_token', 100)->nullable()->index();
            $table->timestamps();

            $table->unique(['tenant_id', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_accounts');

        Schema::table('doctors', function (Blueprint $table) {
            $table->dropColumn('max_daily_appointments');
        });
    }
};
