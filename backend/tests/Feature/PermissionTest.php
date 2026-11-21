<?php

use Laravel\Sanctum\Sanctum;

/**
 * Every route against every role. "ok" means the role is allowed through (anything that is not 401/403),
 * "no" means 403, and a guest always gets 401.
 */
$roles = ['learner', 'teacher', 'admin', 'super_admin'];

// method, path, who is allowed
$routes = [
    ['GET',    '/api/auth/me',                         ['learner', 'teacher', 'admin', 'super_admin']],
    ['POST',   '/api/auth/logout',                     ['learner', 'teacher', 'admin', 'super_admin']],
    ['POST',   '/api/profile',                         ['learner', 'teacher', 'admin', 'super_admin']],
    ['POST',   '/api/profile/password',                ['learner', 'teacher', 'admin', 'super_admin']],
    ['GET',    '/api/signs',                           ['learner', 'teacher', 'admin', 'super_admin']],
    ['GET',    '/api/signs/hints',                     ['learner', 'teacher', 'admin', 'super_admin']],
    ['GET',    '/api/signs/{sign}',                    ['learner', 'teacher', 'admin', 'super_admin']],
    ['GET',    '/api/signs/{sign}/media',              ['learner', 'teacher', 'admin', 'super_admin']],
    ['POST',   '/api/signs',                           ['teacher', 'super_admin']],
    ['POST',   '/api/signs/{sign}',                    ['super_admin']],
    ['DELETE', '/api/signs/{sign}',                    ['super_admin']],
    ['GET',    '/api/signs/{sign}/impact',             ['admin', 'super_admin']],
    ['POST',   '/api/attempts',                        ['learner']],
    ['GET',    '/api/me/attempts',                     ['learner']],
    ['GET',    '/api/me/mastery',                      ['learner']],
    ['GET',    '/api/me/summary',                      ['learner']],
    ['GET',    '/api/teacher/learners-progress',       ['teacher']],
    ['GET',    '/api/teacher/learners-progress/export', ['teacher']],
    ['GET',    '/api/teacher/summary',                 ['teacher']],
    ['GET',    '/api/admin/summary',                   ['admin', 'super_admin']],
    ['GET',    '/api/admin/accounts',                  ['admin', 'super_admin']],
    ['POST',   '/api/admin/accounts',                  ['admin', 'super_admin']],
    ['PUT',    '/api/admin/accounts/{user}',           ['admin', 'super_admin']],
    ['DELETE', '/api/admin/accounts/{user}',           ['admin', 'super_admin']],
    ['GET',    '/api/admin/accounts/{user}/impact',    ['admin', 'super_admin']],
    ['GET',    '/api/admin/audit-logs',                ['super_admin']],
    ['GET',    '/api/admin/audit-logs/{auditLog}',     ['super_admin']],
];

it('answers every route correctly for a guest and for each role', function () use ($routes, $roles) {
    $target = person('learner');
    $s = sign(person('teacher'));
    $audit = \App\Models\AuditLog::query()->create(['action' => 'test.ping', 'user_role' => 'admin']);
    $path = fn (string $p) => str_replace(['{sign}', '{user}', '{auditLog}'], [$s->sign_id, $target->user_id, $audit->audit_id], $p);

    foreach ($routes as [$method, $p, $allowed]) {
        $url = $path($p);

        $this->app['auth']->forgetGuards();
        $guest = $this->json($method, $url);
        expect($guest->getStatusCode())->toBe(401, "guest on {$method} {$p}");

        foreach ($roles as $role) {
            Sanctum::actingAs(person($role));
            $status = $this->json($method, $url)->getStatusCode();
            if (in_array($role, $allowed, true)) {
                expect($status)->not->toBe(403, "{$role} should pass {$method} {$p}")->not->toBe(401);
            } else {
                expect($status)->toBe(403, "{$role} should be refused on {$method} {$p}");
            }
            $this->app['auth']->forgetGuards();
        }
    }
});

it('keeps the sign write routes for the right owner', function () {
    $owner = person('teacher'); $s = sign($owner);
    foreach ([['PUT', 'hint'], ['DELETE', 'hint'], ['POST', 'media'], ['DELETE', 'media']] as [$m, $what]) {
        Sanctum::actingAs(person('teacher'));
        $this->json($m, "/api/signs/{$s->sign_id}/{$what}")->assertForbidden();
        $this->app['auth']->forgetGuards();
    }
});

it('lets guests reach only register and login', function () {
    $this->postJson('/api/auth/login', [])->assertStatus(422);
    $this->postJson('/api/auth/register', [])->assertStatus(422);
});
