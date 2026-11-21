<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)
    ->in('Unit');

function exactKeys(array $data, array $keys): void
{
    expect(collect(array_keys($data))->sort()->values()->all())
        ->toBe(collect($keys)->sort()->values()->all());
}

use App\Models\Attempt;
use App\Models\Sign;
use App\Models\User;
use App\Services\MasteryService;

function person(string $role = 'learner'): User
{
    return User::factory()->create(['role' => $role]);
}

function sign(?User $owner = null, array $attrs = []): Sign
{
    return Sign::factory()->create(array_merge(['userownership_id' => $owner?->user_id], $attrs));
}

/** Records one attempt through the real service, so mastery stays in step. */
function attempt(User $learner, Sign $sign, bool $correct = true, ?string $when = null): Attempt
{
    $result = app(MasteryService::class)->recordAttempt($learner, $sign, $sign->label, 0.9, $correct);
    if ($when) {
        $result['attempt']->forceFill(['created_at' => $when])->save();
    }

    return $result['attempt'];
}
