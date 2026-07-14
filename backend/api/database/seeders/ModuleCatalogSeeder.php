<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
            $exists = DB::table('module_catalog')->where('code', $m['code'])->exists();
            if ($exists) {
                DB::table('module_catalog')->where('code', $m['code'])->update([
                    'name'        => $m['name'],
                    'description' => $m['description'],
                    'is_active'   => $m['is_active'],
                ]);
            } else {
                DB::table('module_catalog')->insert([
                    'id'          => (string) Str::uuid(),
                    'code'        => $m['code'],
                    'name'        => $m['name'],
                    'description' => $m['description'],
                    'is_active'   => $m['is_active'],
                    'created_at'  => now(),
                ]);
            }
        }

        $this->command->info('Module catalog seeded: ' . count($modules) . ' module(s)');
    }
}
