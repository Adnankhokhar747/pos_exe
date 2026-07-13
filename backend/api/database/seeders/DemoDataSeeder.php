<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Database\Seeders\Concerns\SeedsSystemRoles;

class DemoDataSeeder extends Seeder
{
    use SeedsSystemRoles;

    public function run(): void
    {
        // ── Platform admin ─────────────────────────────────────────────────────
        $existing = DB::table('platform_admins')->where('email', 'admin@platform.local')->first();
        if (!$existing) {
            DB::table('platform_admins')->insert([
                'id'            => (string) Str::uuid(),
                'username'      => 'superadmin',
                'email'         => 'admin@platform.local',
                'full_name'     => 'Super Admin',
                'password_hash' => Hash::make('Admin@1234'),
            ]);
            $this->command->info('Platform admin created.');
        }

        // ── Demo plan ──────────────────────────────────────────────────────────
        $plan = DB::table('plans')->where('name', 'Demo Plan')->first();
        if (!$plan) {
            DB::table('plans')->insert([
                'id'            => (string) Str::uuid(),
                'name'          => 'Demo Plan',
                'price_monthly' => 0,
                'branch_limit'  => 3,
                'user_limit'    => 10,
                'invoice_limit' => null,
            ]);
            $plan = DB::table('plans')->where('name', 'Demo Plan')->first();
        }

        // ── Demo tenant ────────────────────────────────────────────────────────
        $tenant = DB::table('tenants')->where('name', 'Demo Company')->first();
        if (!$tenant) {
            $tenantId = (string) Str::uuid();
            DB::table('tenants')->insert([
                'id'            => $tenantId,
                'name'          => 'Demo Company',
                'base_currency' => 'USD',
                'status'        => 'active',
            ]);

            // Subscription
            DB::table('tenant_subscriptions')->insert([
                'id'          => (string) Str::uuid(),
                'tenant_id'   => $tenantId,
                'plan_id'     => $plan->id,
                'status'      => 'active',
                'start_date'  => now(),
                'expiry_date' => now()->addYears(10),
            ]);

            // Default branch
            $branchId = (string) Str::uuid();
            DB::table('branches')->insert([
                'id'        => $branchId,
                'tenant_id' => $tenantId,
                'name'      => 'Main Branch',
                'code'      => 'MAIN',
                'is_active' => true,
            ]);

            // Default warehouse
            DB::table('warehouses')->insert([
                'id'         => (string) Str::uuid(),
                'branch_id'  => $branchId,
                'name'       => 'Main Warehouse',
                'is_default' => true,
            ]);

            // Seed system roles for this tenant
            $this->seedRoles($tenantId);

            // Get Company Admin role
            $adminRoleId = DB::table('roles')
                ->where('tenant_id', $tenantId)
                ->where('name', 'Company Admin')
                ->value('id');

            // Company Admin user
            $userId = (string) Str::uuid();
            DB::table('users')->insert([
                'id'            => $userId,
                'tenant_id'     => $tenantId,
                'username'      => 'admin',
                'email'         => 'admin@demo.local',
                'full_name'     => 'Demo Admin',
                'password_hash' => Hash::make('Admin@1234'),
                'status'        => 'active',
            ]);

            if ($adminRoleId) {
                DB::table('user_roles')->insert([
                    'user_id' => $userId,
                    'role_id' => $adminRoleId,
                ]);
            }

            $this->command->info("Demo tenant created. Login: username=admin, password=Admin@1234, tenantId={$tenantId}");
        } else {
            $this->command->info('Demo tenant already exists, skipping.');
        }

        $this->command->info('Platform admin: username=superadmin, email=admin@platform.local, password=Admin@1234');
    }
}
