<?php

namespace Database\Seeders\Concerns;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

trait SeedsSystemRoles
{
    protected function seedRoles(string $tenantId): void
    {
        $systemRolePermissions = [
            'Company Admin'    => '__ALL__',
            'Cashier'          => ['invoice.create','customer.manage','product.manage','cash.manage','expense.manage'],
            'Inventory Manager'=> ['product.manage','purchase.manage','inventory.adjust','supplier.manage','report.view'],
            'Accountant'       => ['report.view','expense.manage','cash.manage','invoice.void','settings.manage'],
            'Receptionist'     => ['hospital.patient.manage','hospital.appointment.manage','hospital.appointment.viewAll'],
            'Doctor'           => ['hospital.appointment.manage'],
            'Hospital Manager' => ['hospital.doctor.manage','hospital.patient.manage','hospital.appointment.manage','hospital.appointment.viewAll','hospital.report.view','hospital.lab.manage','hospital.lab.results'],
            'HR Manager'          => ['hr.employee.manage','hr.attendance.manage','hr.leave.manage','hr.payroll.manage','hr.report.view','hr.recruitment.manage','hr.expense.manage','hr.benefits.manage'],
            'Waiter'              => ['restaurant.order.manage','restaurant.split.manage'],
            'Kitchen Staff'       => ['restaurant.kds.view'],
            'Restaurant Manager'  => ['restaurant.table.manage','restaurant.order.manage','restaurant.kds.view','restaurant.split.manage','restaurant.report.view'],
        ];

        $allPermissions = DB::table('permissions')->get()->keyBy('code');

        foreach ($systemRolePermissions as $roleName => $permCodes) {
            $existing = DB::table('roles')
                ->where('tenant_id', $tenantId)
                ->where('name', $roleName)
                ->first();

            if (!$existing) {
                $roleId = (string) Str::uuid();
                DB::table('roles')->insert([
                    'id'             => $roleId,
                    'tenant_id'      => $tenantId,
                    'name'           => $roleName,
                    'is_system_role' => true,
                ]);
            } else {
                $roleId = $existing->id;
            }

            DB::table('role_permissions')->where('role_id', $roleId)->delete();

            $rows = [];
            if ($permCodes === '__ALL__') {
                foreach ($allPermissions as $perm) {
                    $rows[] = ['role_id' => $roleId, 'permission_id' => $perm->id];
                }
            } else {
                foreach ($permCodes as $code) {
                    if (isset($allPermissions[$code])) {
                        $rows[] = ['role_id' => $roleId, 'permission_id' => $allPermissions[$code]->id];
                    }
                }
            }

            foreach (array_chunk($rows, 50) as $chunk) {
                DB::table('role_permissions')->insert($chunk);
            }
        }
    }
}
