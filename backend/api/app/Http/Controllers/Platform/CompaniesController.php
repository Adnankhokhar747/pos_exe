<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\Branch;
use App\Models\Warehouse;
use App\Models\User;
use App\Models\Role;
use App\Models\Permission;
use App\Models\Plan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;
use App\Exceptions\NotFoundException;
use Carbon\Carbon;

class CompaniesController extends Controller
{
    public function index(Request $request)
    {
        return Tenant::with('subscription.plan')
            ->when($request->search, fn($q, $s) =>
                $q->where('name', 'ilike', "%{$s}%")
            )
            ->orderBy('name')
            ->limit(200)
            ->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'          => 'required|string',
            'baseCurrency'  => 'string|max:10',
            'planId'        => 'required|uuid',
            'periodMonths'  => 'integer|min:1|max:120',
            'adminUsername' => 'required|string',
            'adminPassword' => 'required|string|min:6',
            'adminFullName' => 'required|string',
            'branchName'    => 'string',
        ]);

        $plan = Plan::findOrFail($request->planId);

        return DB::transaction(function () use ($request, $plan) {
            $tenant = Tenant::create([
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'name'         => $request->name,
                'base_currency'=> $request->baseCurrency ?? 'USD',
            ]);

            $months = $request->periodMonths ?? 12;
            TenantSubscription::create([
                'id'         => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'  => $tenant->id,
                'plan_id'    => $plan->id,
                'start_date' => now(),
                'expiry_date'=> now()->addMonths($months),
                'status'     => 'active',
            ]);

            $branch = Branch::create([
                'id'        => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id' => $tenant->id,
                'name'      => $request->branchName ?? 'Main Branch',
                'code'      => 'MAIN',
            ]);

            Warehouse::create([
                'id'        => (string) \Illuminate\Support\Str::uuid(),
                'branch_id' => $branch->id,
                'name'      => 'Main Warehouse',
                'is_default'=> true,
            ]);

            $this->seedRoles($tenant->id);

            $adminRole = Role::where('tenant_id', $tenant->id)->where('name', 'Company Admin')->first();

            $user = User::create([
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'    => $tenant->id,
                'full_name'    => $request->adminFullName,
                'username'     => $request->adminUsername,
                'password_hash'=> Hash::make($request->adminPassword),
            ]);

            if ($adminRole) {
                DB::table('user_roles')->insert([
                    'user_id' => $user->id,
                    'role_id' => $adminRole->id,
                ]);
            }

            return $tenant->load('subscription.plan');
        });
    }

    public function show(string $id)
    {
        $tenant = Tenant::with('subscription.plan')->find($id);
        if (!$tenant) throw new NotFoundException("Company {$id} not found.");
        return $tenant;
    }

    public function update(Request $request, string $id)
    {
        $tenant = Tenant::find($id);
        if (!$tenant) throw new NotFoundException("Company {$id} not found.");

        $tenant->update($request->only(['name','status','address','tax_number','base_currency']));
        return $tenant->load('subscription.plan');
    }

    public function getSubscription(string $id)
    {
        $tenant = Tenant::find($id);
        if (!$tenant) throw new NotFoundException("Company {$id} not found.");
        return $tenant->subscription()->with('plan')->first();
    }

    public function assignPlan(Request $request, string $id)
    {
        $request->validate(['planId' => 'required|uuid', 'periodMonths' => 'integer|min:1']);
        $tenant = Tenant::findOrFail($id);
        $plan = Plan::findOrFail($request->planId);
        $months = $request->periodMonths ?? 12;

        $sub = TenantSubscription::updateOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'id'          => (string) \Illuminate\Support\Str::uuid(),
                'plan_id'     => $plan->id,
                'start_date'  => now(),
                'expiry_date' => now()->addMonths($months),
                'status'      => 'active',
            ]
        );

        return $sub->load('plan');
    }

    public function renewSubscription(Request $request, string $id)
    {
        $request->validate(['extendMonths' => 'integer|min:1']);
        $tenant = Tenant::findOrFail($id);
        $sub = TenantSubscription::where('tenant_id', $tenant->id)->firstOrFail();
        $months = $request->extendMonths ?? 12;

        $base = Carbon::parse($sub->expiry_date)->isFuture()
            ? Carbon::parse($sub->expiry_date)
            : now();

        $sub->update([
            'expiry_date' => $base->addMonths($months),
            'status'      => 'active',
        ]);

        return $sub->load('plan');
    }

    public function getUsers(string $id)
    {
        $tenant = Tenant::find($id);
        if (!$tenant) throw new NotFoundException("Company {$id} not found.");

        return User::where('tenant_id', $id)
            ->with('roles')
            ->orderBy('full_name')
            ->get();
    }

    private function seedRoles(string $tenantId): void
    {
        $allPermissions = Permission::pluck('id', 'code');

        $roleMap = [
            'Company Admin'    => ['ALL'],
            'Cashier'          => ['pos.sale','pos.hold','pos.return','pos.void','pos.customer.view','pos.drawer.open'],
            'Inventory Manager'=> ['inventory.view','inventory.manage','purchasing.manage','catalog.manage'],
            'Accountant'       => ['accounting.view','accounting.manage','reports.view'],
            'Receptionist'     => ['hospital.patient.manage','hospital.appointment.manage'],
            'Doctor'           => ['hospital.appointment.manage'],
            'Hospital Manager' => ['hospital.doctor.manage','hospital.patient.manage','hospital.appointment.manage','hospital.appointment.viewAll','hospital.report.view'],
        ];

        foreach ($roleMap as $roleName => $permCodes) {
            $role = Role::create([
                'id'             => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'      => $tenantId,
                'name'           => $roleName,
                'is_system_role' => true,
            ]);

            if (in_array('ALL', $permCodes)) {
                $perms = $allPermissions->values()->map(fn($id) => [
                    'role_id' => $role->id, 'permission_id' => $id,
                ])->toArray();
            } else {
                $perms = collect($permCodes)
                    ->filter(fn($c) => isset($allPermissions[$c]))
                    ->map(fn($c) => ['role_id' => $role->id, 'permission_id' => $allPermissions[$c]])
                    ->toArray();
            }

            if ($perms) {
                DB::table('role_permissions')->insert($perms);
            }
        }
    }
}
