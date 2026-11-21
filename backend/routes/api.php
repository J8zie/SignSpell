<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AttemptController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\LearnerController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SignController;
use App\Http\Controllers\SignHintController;
use App\Http\Controllers\SignMediaController;
use App\Http\Controllers\SignSampleController;
use App\Http\Controllers\TeacherController;
use Illuminate\Support\Facades\Route;

// Public liveness check for the host's health monitor.
Route::get('health', fn () => response()->json(['ok' => true]));

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login-ip');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::match(['post', 'put'], 'profile', [ProfileController::class, 'update']);
    Route::post('profile/password', [ProfileController::class, 'password']);

    Route::get('signs/hints', [SignHintController::class, 'index']);
    Route::get('signs', [SignController::class, 'index']);
    Route::post('signs', [SignController::class, 'store'])->middleware('role:teacher,super_admin');

    Route::get('signs/{sign}/hint', [SignHintController::class, 'show']);
    Route::put('signs/{sign}/hint', [SignHintController::class, 'update'])->middleware('role:teacher,super_admin');
    Route::delete('signs/{sign}/hint', [SignHintController::class, 'destroy'])->middleware('role:teacher,super_admin');

    Route::get('signs/{sign}/media', [SignMediaController::class, 'index']);
    Route::post('signs/{sign}/media', [SignMediaController::class, 'store'])->middleware('role:teacher,super_admin');
    Route::delete('signs/{sign}/media', [SignMediaController::class, 'destroy'])->middleware('role:teacher,super_admin');
    Route::post('signs/{sign}/media/analyze', [SignMediaController::class, 'analyze'])->middleware('role:teacher,super_admin');
    Route::get('signs/{sign}/samples', [SignSampleController::class, 'index'])->middleware('role:teacher,super_admin');
    Route::post('signs/{sign}/samples', [SignSampleController::class, 'store'])->middleware('role:teacher,super_admin');

    Route::get('signs/{sign}/impact', [SignController::class, 'impact'])->middleware('role:admin');
    Route::get('signs/{sign}', [SignController::class, 'show']);
    Route::match(['post', 'put'], 'signs/{sign}', [SignController::class, 'update'])->middleware('role:super_admin');
    Route::delete('signs/{sign}', [SignController::class, 'destroy'])->middleware('role:super_admin');

    Route::post('attempts', [AttemptController::class, 'store'])->middleware(['role:learner', 'throttle:attempts']);
    Route::get('me/attempts', [LearnerController::class, 'attempts'])->middleware('role:learner');
    Route::get('me/mastery', [LearnerController::class, 'mastery'])->middleware('role:learner');
    Route::get('me/summary', [LearnerController::class, 'summary'])->middleware('role:learner');

    Route::get('teacher/learners-progress/export', [TeacherController::class, 'export'])->middleware('role:teacher');
    Route::get('teacher/learners-progress', [TeacherController::class, 'progress'])->middleware('role:teacher');
    Route::get('teacher/summary', [TeacherController::class, 'summary'])->middleware('role:teacher');

    Route::get('admin/summary', [AdminController::class, 'summary'])->middleware('role:admin');
    Route::get('admin/accounts/{user}/impact', [AccountController::class, 'impact'])->middleware('role:admin');
    Route::get('admin/accounts', [AccountController::class, 'index'])->middleware('role:admin');
    Route::post('admin/accounts', [AccountController::class, 'store'])->middleware('role:admin');
    Route::put('admin/accounts/{user}', [AccountController::class, 'update'])->middleware('role:admin');
    Route::delete('admin/accounts/{user}', [AccountController::class, 'destroy'])->middleware('role:admin');

    // Audit logs are read-only and Super Admin only; there are intentionally no write routes.
    Route::get('admin/audit-logs', [AuditLogController::class, 'index'])->middleware('role:super_admin');
    Route::get('admin/audit-logs/{auditLog}', [AuditLogController::class, 'show'])->middleware('role:super_admin');
});
