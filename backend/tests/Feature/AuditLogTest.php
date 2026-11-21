<?php

use App\Models\AuditLog;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

it('paginates audit logs twenty at a time', function () {
    $rows = [];
    for ($i = 0; $i < 45; $i++) {
        $rows[] = [
            'audit_id' => (string) Str::uuid(),
            'action' => 'test.ping',
            'user_role' => 'admin',
            'created_at' => now(),
        ];
    }
    AuditLog::query()->insert($rows);

    Sanctum::actingAs(person('super_admin'));

    $first = $this->getJson('/api/admin/audit-logs')->assertOk();
    expect($first->json('data'))->toHaveCount(20)
        ->and($first->json('meta.total'))->toBe(45)
        ->and($first->json('meta.last_page'))->toBe(3);

    $third = $this->getJson('/api/admin/audit-logs?page=3')->assertOk();
    expect($third->json('data'))->toHaveCount(5)
        ->and($third->json('meta.current_page'))->toBe(3);
});

it('lists only the days that have audit entries', function () {
    $days = ['2026-11-20 10:00:00', '2026-11-20 18:00:00', '2026-11-18 09:00:00'];
    foreach ($days as $at) {
        AuditLog::query()->create(['action' => 'test.ping', 'user_role' => 'admin'])
            ->forceFill(['created_at' => $at])->save();
    }

    Sanctum::actingAs(person('super_admin'));

    $this->getJson('/api/admin/audit-logs/dates')->assertOk()
        ->assertExactJson(['2026-11-20', '2026-11-18']);
});
