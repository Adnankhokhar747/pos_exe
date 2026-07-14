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
        $tenants = Tenant::with('subscription.plan')
            ->when($request->search, fn($q, $s) =>
                $q->where('name', 'ilike', "%{$s}%")
            )
            ->orderBy('name')
            ->limit(200)
            ->get();

        // Batch-load counts for all tenants to avoid N+1
        $tenantIds = $tenants->pluck('id');
        $userCounts   = DB::table('users')->whereIn('tenant_id', $tenantIds)
            ->select('tenant_id', DB::raw('count(*) as cnt'))->groupBy('tenant_id')->pluck('cnt', 'tenant_id');
        $branchCounts = DB::table('branches')->whereIn('tenant_id', $tenantIds)
            ->select('tenant_id', DB::raw('count(*) as cnt'))->groupBy('tenant_id')->pluck('cnt', 'tenant_id');
        // invoices link through branch_id → branches.tenant_id
        $invoiceCounts = DB::table('invoices')
            ->join('branches', 'branches.id', '=', 'invoices.branch_id')
            ->whereIn('branches.tenant_id', $tenantIds)
            ->select('branches.tenant_id', DB::raw('count(*) as cnt'))
            ->groupBy('branches.tenant_id')->pluck('cnt', 'branches.tenant_id');

        return $tenants->map(fn($t) => $this->formatCompany($t, $userCounts[$t->id] ?? 0, $invoiceCounts[$t->id] ?? 0, $branchCounts[$t->id] ?? 0));
    }

    private function formatCompany(Tenant $tenant, int $userCount = 0, int $invoiceCount = 0, int $branchCount = 0): array
    {
        $sub  = $tenant->subscription;
        $plan = $sub?->plan;

        $subscriptionStatus = $sub?->status ?? 'cancelled';
        $expiryDate = $sub?->expiry_date ? Carbon::parse($sub->expiry_date) : null;
        $gracePeriodDays = $sub?->grace_period_days ?? 7;

        $now = Carbon::now();
        $daysUntilExpiry = $expiryDate ? (int) $now->diffInDays($expiryDate, false) : -9999;
        $inGracePeriod = $daysUntilExpiry < 0 && $daysUntilExpiry >= -$gracePeriodDays;
        $pastGrace = $daysUntilExpiry < -$gracePeriodDays;

        $tenantActive = $tenant->status === 'active';
        $blocked = !$tenantActive || ($subscriptionStatus !== 'active' && !$inGracePeriod) || $pastGrace;

        if (!$tenantActive) {
            $warningLevel = 'critical';
        } elseif ($pastGrace || $subscriptionStatus === 'expired') {
            $warningLevel = 'critical';
        } elseif ($inGracePeriod) {
            $warningLevel = 'critical';
        } elseif ($daysUntilExpiry <= 7) {
            $warningLevel = 'warning';
        } elseif ($daysUntilExpiry <= 14) {
            $warningLevel = 'info';
        } else {
            $warningLevel = 'none';
        }

        return [
            'id'        => $tenant->id,
            'name'      => $tenant->name,
            'status'    => $tenant->status,
            'createdAt' => $tenant->created_at?->toISOString(),
            'plan'      => $plan ? ['id' => $plan->id, 'name' => $plan->name] : null,
            'license'   => [
                'tenantActive'       => $tenantActive,
                'subscriptionStatus' => $subscriptionStatus,
                'daysUntilExpiry'    => $daysUntilExpiry,
                'inGracePeriod'      => $inGracePeriod,
                'blocked'            => $blocked,
                'warningLevel'       => $warningLevel,
                'message'            => null,
                'userLimit'          => $plan?->user_limit,
                'userCount'          => $userCount,
                'invoiceLimit'       => $plan?->invoice_limit,
                'invoiceCount'       => $invoiceCount,
                'branchLimit'        => $plan?->branch_limit,
                'branchCount'        => $branchCount,
            ],
        ];
    }

    public function activate(string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update(['status' => 'active']);
        return response()->json($this->formatCompany($tenant->load('subscription.plan')));
    }

    public function suspend(string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update(['status' => 'suspended']);
        return response()->json($this->formatCompany($tenant->load('subscription.plan')));
    }

    public function destroy(string $id)
    {
        $tenant = Tenant::findOrFail($id);
        // Only allow deletion if tenant has no financial data
        $hasData = DB::table('invoices')
                ->join('branches', 'branches.id', '=', 'invoices.branch_id')
                ->where('branches.tenant_id', $id)->exists()
            || DB::table('products')->where('tenant_id', $id)->exists();
        if ($hasData) {
            return response()->json(['message' => 'Cannot delete a company that has sales or catalog data. Suspend it instead.'], 422);
        }
        $tenant->delete();
        return response()->json(null, 204);
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

            $tenant->load('subscription.plan');
            return response()->json($this->formatCompany($tenant));
        });
    }

    public function show(string $id)
    {
        $tenant = Tenant::with('subscription.plan')->findOrFail($id);
        return response()->json($this->formatCompany($tenant));
    }

    public function update(Request $request, string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update($request->only(['name','status','address','tax_number','base_currency']));
        $tenant->load('subscription.plan');
        return response()->json($this->formatCompany($tenant));
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
