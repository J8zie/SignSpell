<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

abstract class Controller
{
    /** Returns the user's time zone from ?tz=, or UTC if it is missing or invalid. */
    protected function zone(Request $request): string
    {
        $tz = (string) $request->query('tz', '');

        return in_array($tz, timezone_identifiers_list(), true) ? $tz : 'UTC';
    }

    /** Returns the first moment of a Y-m-d day in the user's zone, converted to UTC. */
    protected function dayStart(Request $request, string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, $this->zone($request))->startOfDay()->setTimezone('UTC');
    }

    /** Returns the last moment of a Y-m-d day in the user's zone, converted to UTC. */
    protected function dayEnd(Request $request, string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, $this->zone($request))->endOfDay()->setTimezone('UTC');
    }
}
