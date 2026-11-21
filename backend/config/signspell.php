<?php

return [

    'roles' => ['learner', 'teacher', 'admin', 'super_admin'],

    'token_days' => (int) env('SANCTUM_TOKEN_DAYS', 30),

    'label' => [
        'word_min' => 2,
        'word_max' => 12,
        'sentence_min_words' => 2,
        'sentence_max_words' => 5,
    ],

    'image' => [
        'max_kb' => 2048,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp'],
        'mimetypes' => ['image/jpeg', 'image/png', 'image/webp'],
        'pictures_min' => 1,
        'pictures_max' => 12,
    ],

    'video' => [
        'max_kb' => 25600,
        'mimes' => ['mp4', 'webm', 'mov'],
        'mimetypes' => ['video/mp4', 'video/webm', 'video/quicktime'],
    ],

    'mastery' => [
        'mastered_attempts' => 5,
        'mastered_avg' => 0.85,
        'familiar_attempts' => 3,
        'familiar_avg' => 0.6,
    ],

    'hint_max_chars' => 200,

    'attempt' => [
        'predicted_label_max' => 60,
    ],

    'limits' => [
        'login_per_minute' => 5,
        'attempts_per_minute' => 120,
        'api_per_minute' => 120,
        'register_per_minute' => 10,   // new accounts, per IP address
        'login_ip_per_minute' => 30,   // all login tries, per IP address (the per-username limit stays at login_per_minute)
    ],

    'signs_cache_seconds' => 60,

];
