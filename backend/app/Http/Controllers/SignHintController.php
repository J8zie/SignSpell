<?php

namespace App\Http\Controllers;

use App\Http\Requests\HintRequest;
use App\Models\Sign;
use App\Models\SignHint;
use App\Services\Audit;
use Illuminate\Http\Request;

class SignHintController extends Controller
{
    // Returns every sign's hint as a signId => text map.
    public function index()
    {
        $map = [];
        foreach (SignHint::query()->get(['sign_id', 'text']) as $hint) {
            $map[$hint->sign_id] = $hint->text;
        }

        return response()->json($map);
    }

    // Returns one sign's hint text.
    public function show(Sign $sign)
    {
        $hint = $sign->hint;
        if (! $hint) {
            return response()->json(['message' => 'We could not find that.'], 404);
        }

        return response()->json(['text' => $hint->text]);
    }

    // Saves a sign's hint, or deletes it when the text is empty.
    public function update(HintRequest $request, Sign $sign)
    {
        $this->authorizeEditor($request, $sign);
        $text = trim($request->input('text') ?? '');

        if ($text === '') {
            $sign->hint()?->delete();
            Audit::record($request->user(), Audit::HINT_DELETE, $request, 'sign', $sign->sign_id, "Cleared hint on \"{$sign->label}\".");

            return response()->noContent();
        }

        $old = $sign->hint?->text;
        SignHint::query()->updateOrCreate(
            ['sign_id' => $sign->sign_id],
            ['text' => $text],
        );
        Audit::record($request->user(), Audit::HINT_UPDATE, $request, 'sign', $sign->sign_id, "Updated hint on \"{$sign->label}\".", ['text' => $old], ['text' => $text]);

        return response()->json(['text' => $text]);
    }

    // Deletes a sign's hint.
    public function destroy(Request $request, Sign $sign)
    {
        $this->authorizeEditor($request, $sign);
        $sign->hint()?->delete();
        Audit::record($request->user(), Audit::HINT_DELETE, $request, 'sign', $sign->sign_id, "Deleted hint on \"{$sign->label}\".");

        return response()->noContent();
    }

    // Stops users who are not allowed to edit this sign.
    private function authorizeEditor(Request $request, Sign $sign): void
    {
        if (! $sign->editableBy($request->user())) {
            abort(403, 'You do not have access to this.');
        }
    }
}
