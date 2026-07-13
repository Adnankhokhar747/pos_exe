<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PermissionsSeeder extends Seeder
{
    const PERMISSION_CATALOG = [
        ['code' => 'product.manage',                 'module' => 'pos',      'description' => 'Create, edit, and delete products and categories'],
        ['code' => 'invoice.create',                 'module' => 'pos',      'description' => 'Create sale invoices'],
        ['code' => 'invoice.void',                   'module' => 'pos',      'description' => 'Void completed invoices'],
        ['code' => 'customer.manage',                'module' => 'pos',      'description' => 'Create and edit customer records'],
        ['code' => 'supplier.manage',                'module' => 'pos',      'description' => 'Create and edit supplier records'],
        ['code' => 'purchase.manage',                'module' => 'pos',      'description' => 'Create purchase orders and receive goods'],
        ['code' => 'inventory.adjust',               'module' => 'pos',      'description' => 'Create stock adjustments and transfers'],
        ['code' => 'expense.manage',                 'module' => 'pos',      'description' => 'Record and void expenses and income'],
        ['code' => 'cash.manage',                    'module' => 'pos',      'description' => 'Open and close cash drawer sessions'],
        ['code' => 'report.view',                    'module' => 'pos',      'description' => 'View sales and stock reports'],
        ['code' => 'user.manage',                    'module' => 'pos',      'description' => 'Create and manage users and their roles'],
        ['code' => 'settings.manage',                'module' => 'pos',      'description' => 'Edit receipt settings, printers, and daily closings'],
        ['code' => 'hospital.doctor.manage',         'module' => 'hospital', 'description' => 'Create, edit, and manage doctor profiles and schedules'],
        ['code' => 'hospital.patient.manage',        'module' => 'hospital', 'description' => 'Create and edit patient records'],
        ['code' => 'hospital.appointment.manage',    'module' => 'hospital', 'description' => 'Create, update, and transition appointments and issue tokens'],
        ['code' => 'hospital.appointment.viewAll',   'module' => 'hospital', 'description' => "View every doctor's appointments and queue"],
        ['code' => 'hospital.report.view',           'module' => 'hospital', 'description' => 'View hospital and doctor reports'],
    ];

    const SYSTEM_ROLE_PERMISSIONS = [
        'Company Admin' => '__ALL__',
        'Cashier' => [
            'invoice.create',
            'customer.manage',
            'product.manage',
            'cash.manage',
            'expense.manage',
        ],
        'Inventory Manager' => [
            'product.manage',
            'purchase.manage',
            'inventory.adjust',
            'supplier.manage',
            'report.view',
        ],
        'Accountant' => [
            'report.view',
            'expense.manage',
            'cash.manage',
            'invoice.void',
            'settings.manage',
        ],
        'Receptionist' => [
            'hospital.patient.manage',
            'hospital.appointment.manage',
            'hospital.appointment.viewAll',
        ],
        'Doctor' => [
            'hospital.appointment.manage',
        ],
        'Hospital Manager' => [
            'hospital.doctor.manage',
            'hospital.patient.manage',
            'hospital.appointment.manage',
            'hospital.appointment.viewAll',
            'hospital.report.view',
        ],
    ];

    public function run(): void
    {
        foreach (self::PERMISSION_CATALOG as $p) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $p['code']],
                [
                    'id'          => DB::raw("COALESCE((SELECT id FROM permissions WHERE code = '{$p['code']}'), gen_random_uuid())"),
                    'code'        => $p['code'],
                    'module'      => $p['module'],
                    'description' => $p['description'],
                ]
            );
        }

        $this->command->info('Permissions seeded: ' . count(self::PERMISSION_CATALOG));
    }
}
