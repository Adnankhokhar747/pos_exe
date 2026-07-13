<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ModuleCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            [
                'code'        => 'hospital',
                'name'        => 'Hospital / Doctor Management',
                'description' => 'Manage doctors, patients, appointments, token queues, and hospital billing.',
                'is_active'   => true,
            ],
        ];

        foreach ($modules as $m) {
            DB::table('module_catalog')->updateOrInsert(
                ['code' => $m['code']],
                [
                    'id'          => DB::raw("COALESCE((SELECT id FROM module_catalog WHERE code = '{$m['code']}'), gen_random_uuid())"),
                    'code'        => $m['code'],
                    'name'        => $m['name'],
                    'description' => $m['description'],
                    'is_active'   => $m['is_active'],
                ]
            );
        }

        $this->command->info('Module catalog seeded: ' . count($modules) . ' module(s)');
    }
}
