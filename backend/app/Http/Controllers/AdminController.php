<?php

namespace App\Http\Controllers;

use App\Models\Attempt;
use App\Models\Sign;
use App\Models\User;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    // Returns totals of users by role, signs, and attempts made today.
    public function summary(Request $request)
    {
        return response()->json([
            'learners' => User::query()->where('role', 'learner')->count(),
            'teachers' => User::query()->where('role', 'teacher')->count(),
            'admins' => User::query()->whereIn('role', ['admin', 'super_admin'])->count(),
            'signs' => Sign::query()->count(),
            'donatedSigns' => Sign::query()->whereNotNull('userownership_id')->count(),
            'attemptsToday' => Attempt::query()->where('created_at', '>=', now($this->zone($request))->startOfDay()->setTimezone('UTC'))->count(),
        ]);
    }
}
