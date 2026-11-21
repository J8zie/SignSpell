<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProgressRowResource;
use App\Models\Attempt;
use App\Models\Sign;
use App\Models\User;
use App\Services\MasteryService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class TeacherController extends Controller
{
    // Wires in the mastery service used to compute levels.
    public function __construct(private MasteryService $mastery) {}

    // Returns learner progress rows for the signs this teacher donated.
    public function progress(Request $request)
    {
        return ProgressRowResource::collection($this->rows($request));
    }

    // Downloads the same progress rows as a CSV file.
    public function export(Request $request)
    {
        $rows = $this->rows($request);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Learner', 'Sign', 'Type', 'Attempts', 'Correct %', 'Level', 'Last practiced']);

            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['learnerName'],
                    $row['signLabel'],
                    $row['signType'],
                    $row['attemptsCount'],
                    (int) round($row['correctAvg'] * 100),
                    $row['masteryLevel'],
                    $row['lastAttemptAt'],
                ]);
            }

            fclose($out);
        }, 'learners-progress.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    // Returns stats about the teacher's donated signs and the learners using them.
    public function summary(Request $request)
    {
        $teacher = $request->user();
        $signIds = Sign::query()->where('userownership_id', $teacher->user_id)->pluck('sign_id');
        $attempts = Attempt::query()->whereIn('sign_id', $signIds);
        $total = (clone $attempts)->count();
        $correct = (clone $attempts)->where('is_correct', true)->count();
        $last = (clone $attempts)->max('created_at');

        return response()->json([
            'learners' => (clone $attempts)->distinct()->count('learners_id'),
            'attempts' => $total,
            'accuracy' => $total === 0 ? 0 : $correct / $total,
            'signsDonated' => $signIds->count(),
            'lastActivityAt' => $last ? Carbon::parse($last)->toIso8601String() : null,
        ]);
    }

    // Builds the filtered learner-by-sign progress rows used by progress and export.
    private function rows(Request $request): Collection
    {
        validator($request->query(), [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'signId' => ['nullable', 'uuid'],
            'learner' => ['nullable', 'uuid'],
            'mastery' => ['nullable', 'in:new,learning,familiar,mastered'],
            'tz' => ['nullable', 'timezone:all'],
        ], [
            'from.date_format' => 'Use a date like 2026-01-31.',
            'to.date_format' => 'Use a date like 2026-01-31.',
            'to.after_or_equal' => 'The end date cannot be before the start date.',
            'tz.timezone' => 'Choose a valid time zone.',
        ])->validate();

        $teacher = $request->user();
        $owned = Sign::query()->where('userownership_id', $teacher->user_id);

        if ($request->filled('signId')) {
            $signId = $request->query('signId');
            if (! (clone $owned)->where('sign_id', $signId)->exists()) {
                abort(403, 'You do not have access to this.');
            }
            $signIds = collect([$signId]);
        } else {
            $signIds = $owned->pluck('sign_id');
        }

        $attempts = Attempt::query()
            ->whereIn('sign_id', $signIds)
            ->with(['learner.info', 'sign']);

        if ($request->filled('from')) {
            $attempts->where('created_at', '>=', $this->dayStart($request, $request->query('from')));
        }

        if ($request->filled('to')) {
            $attempts->where('created_at', '<=', $this->dayEnd($request, $request->query('to')));
        }

        if ($request->filled('learner')) {
            $attempts->where('learners_id', $request->query('learner'));
        }

        $rows = $attempts->get()
            ->groupBy(fn (Attempt $attempt) => $attempt->learners_id.'|'.$attempt->sign_id)
            ->map(function (Collection $group) {
                $first = $group->first();
                $count = $group->count();
                $correct = $group->where('is_correct', true)->count();
                $average = $count === 0 ? 0 : $correct / $count;
                $last = $group->sortByDesc('created_at')->first()->created_at;

                return [
                    'learnerId' => $first->learners_id,
                    'learnerName' => $this->learnerName($first->learner),
                    'signId' => $first->sign_id,
                    'signLabel' => $first->sign?->label,
                    'signType' => $first->sign?->sign_type,
                    'attemptsCount' => $count,
                    'correctAvg' => $average,
                    'masteryLevel' => $this->mastery->levelFor($count, $average),
                    'lastAttemptAt' => $last?->toIso8601String(),
                ];
            })
            ->when($request->filled('mastery'), function (Collection $rows) use ($request) {
                return $rows->where('masteryLevel', $request->query('mastery'));
            })
            ->sortByDesc('lastAttemptAt')
            ->values();

        return $rows;
    }

    // Picks the best display name for a learner (full name, else username).
    private function learnerName(?User $user): string
    {
        if (! $user) {
            return 'Learner';
        }

        $info = $user->info;
        $name = trim(((string) ($info->first_name ?? '')).' '.((string) ($info->last_name ?? '')));

        return $name !== '' ? $name : $user->username;
    }
}
