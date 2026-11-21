<?php

namespace App\Http\Controllers;

use App\Http\Resources\AttemptResource;
use App\Http\Resources\MasteryResource;
use App\Http\Resources\SignResource;
use App\Models\Attempt;
use App\Models\Mastery;
use App\Models\Sign;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LearnerController extends Controller
{
    // Returns the learner's practice attempts, with optional filters.
    public function attempts(Request $request)
    {
        $this->validateFilters($request);

        $query = Attempt::query()->where('learners_id', $request->user()->user_id);

        if ($request->filled('signId')) {
            $query->where('sign_id', $request->query('signId'));
        }

        if ($request->filled('type')) {
            $type = $request->query('type');
            $query->whereHas('sign', fn ($signs) => $signs->where('sign_type', $type));
        }

        $this->applyDates($request, $query);
        $query->orderByDesc('created_at');

        if ($request->filled('limit')) {
            $query->limit((int) $request->query('limit'));
        }

        return AttemptResource::collection($query->get());
    }

    // Returns the learner's mastery level for every sign.
    public function mastery(Request $request)
    {
        $rows = Mastery::query()
            ->where('learners_id', $request->user()->user_id)
            ->orderByDesc('updated_at')
            ->get();

        return MasteryResource::collection($rows);
    }

    // Returns the learner's totals, accuracy, streak, and suggested next signs.
    public function summary(Request $request)
    {
        validator($request->query(), ['tz' => ['nullable', 'timezone:all']], ['tz.timezone' => 'Choose a valid time zone.'])->validate();
        $user = $request->user();
        $attempts = Attempt::query()->where('learners_id', $user->user_id);
        $total = (clone $attempts)->count();
        $correct = (clone $attempts)->where('is_correct', true)->count();

        $levels = Mastery::query()
            ->where('learners_id', $user->user_id)
            ->selectRaw('mastery_level, count(*) as total')
            ->groupBy('mastery_level')
            ->pluck('total', 'mastery_level');

        $byType = Attempt::query()
            ->where('attempts.learners_id', $user->user_id)
            ->join('signs', 'signs.sign_id', '=', 'attempts.sign_id')
            ->selectRaw('signs.sign_type as sign_type, count(*) as total')
            ->groupBy('signs.sign_type')
            ->pluck('total', 'sign_type');

        $next = Sign::query()
            ->select('signs.*')
            ->with(['owner.info'])
            ->leftJoin('mastery', function ($join) use ($user) {
                $join->on('mastery.sign_id', '=', 'signs.sign_id')
                    ->where('mastery.learners_id', '=', $user->user_id);
            })
            ->orderByRaw('case when mastery.mastery_id is null then 0 else 1 end')
            ->orderByRaw('coalesce(mastery.correct_avg, 0) asc')
            ->orderBy('signs.label')
            ->limit(5)
            ->get();

        return response()->json([
            'totalAttempts' => $total,
            'accuracy' => $total === 0 ? 0 : $correct / $total,
            'mastered' => (int) ($levels['mastered'] ?? 0),
            'familiar' => (int) ($levels['familiar'] ?? 0),
            'learning' => (int) ($levels['learning'] ?? 0),
            'newCount' => max(0, Sign::query()->count() - (int) $levels->sum()),
            'streakDays' => $this->streakDays($user->user_id, $this->zone($request)),
            'byType' => [
                'letter' => (int) ($byType['letter'] ?? 0),
                'word' => (int) ($byType['word'] ?? 0),
                'sentence' => (int) ($byType['sentence'] ?? 0),
            ],
            'practiceNext' => SignResource::collection($next)->resolve($request),
        ]);
    }

    // Counts how many days in a row the learner has practiced, ending today or yesterday.
    private function streakDays(string $learnerId, string $zone): int
    {
        $days = Attempt::query()
            ->where('learners_id', $learnerId)
            ->orderByDesc('created_at')
            ->pluck('created_at')
            ->map(fn ($date) => Carbon::parse($date, 'UTC')->setTimezone($zone)->startOfDay())
            ->unique(fn (Carbon $date) => $date->toDateString())
            ->values();

        if ($days->isEmpty()) {
            return 0;
        }

        $cursor = now($zone)->startOfDay();
        $first = $days[0]->copy();

        if ($first->equalTo($cursor->copy()->subDay())) {
            $cursor = $cursor->copy()->subDay();
        } elseif (! $first->equalTo($cursor)) {
            return 0;
        }

        $streak = 0;
        foreach ($days as $day) {
            if ($day->equalTo($cursor)) {
                $streak++;
                $cursor = $cursor->copy()->subDay();
                continue;
            }

            if ($day->lt($cursor)) {
                break;
            }
        }

        return $streak;
    }

    // Checks that the attempt-list query filters are valid.
    private function validateFilters(Request $request): void
    {
        validator($request->query(), [
            'signId' => ['nullable', 'uuid'],
            'type' => ['nullable', 'in:letter,word,sentence'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'tz' => ['nullable', 'timezone:all'],
        ], [
            'from.date_format' => 'Use a date like 2026-01-31.',
            'to.date_format' => 'Use a date like 2026-01-31.',
            'to.after_or_equal' => 'The end date cannot be before the start date.',
            'limit.max' => 'Ask for 500 attempts or fewer.',
            'tz.timezone' => 'Choose a valid time zone.',
        ])->validate();
    }

    // Adds the from/to date filters to an attempts query.
    private function applyDates(Request $request, $query): void
    {
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $this->dayStart($request, $request->query('from')));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $this->dayEnd($request, $request->query('to')));
        }
    }
}
