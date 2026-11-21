# Recognition pipeline (Figure 1: Input, Process, Output)

Everything runs in the browser, in `src/app/recognition/`. No video is uploaded, and **no model is downloaded**:
MediaPipe Hands (`@mediapipe/hands`) ships inside the app (`angular.json` copies it to `/mediapipe/hands`), so tracking works
offline and never depends on an internet connection or on a third-party host.

| Step (Figure 1) | File | What it does |
| --- | --- | --- |
| Live webcam video | `sources.ts` `CameraSource` | `getUserMedia`, one frame at a time |
| Hand detection | `sources.ts` | MediaPipe Hands, 21 points per frame, served from this app |
| Normalization landmark | `landmarks.ts` `normalize()` | wrist = origin, scale by wrist-to-middle-knuckle distance, `x *= width/height`, mirrored when the index-to-pinky knuckle line turns the other way. Mirroring uses the hand's geometry, never MediaPipe's Left/Right label (it flips from frame to frame on the same hand). 63 numbers out |
| Classification | `classifier.ts` | `ruleClassify()` baseline, or `KnnClassifier` when `classifierSamplesUrl` is set |
| Look-alike rule | `classifier.ts` `lookAlike()` | thumb position separates A, M, N, S, T (also re-decides a trained model's answer for those 5) |
| Frame correction | `frame-voter.ts` | a sign counts only after ~1 s of votes (>= 70% of frames, >= 4 frames) |
| J and Z | `path-rule.ts` | the fingertip path while the hand is an I (J) or a pointing finger (Z) |
| Word / sentence builder | `sequence-builder.ts`, `engine.ts` | builds the word, Space button between words, a repeated letter needs the hand to change or leave first |
| Check lighting and visibility | `lighting.ts` | brightness, contrast, hand size, hand touching the edge |
| Green / red feedback + hint | `engine.ts`, `hints.ts` | per-finger corrective hints, always falls back to the letter's cue |
| Save attempts and mastery | `pages/learner/practice` | `POST /attempts`, see docs/API.md |

## If the camera does not start

The app reports the real cause instead of a vague message (the exact error is shown under "Technical details"):

| Message | Cause |
| --- | --- |
| needs a secure page | the site is on plain `http://` (use https or localhost) |
| permission is blocked / no camera / busy | the browser or another app, see the text shown |
| hand-tracking files are missing | `npm install` was not run, or the build did not copy `/mediapipe/hands` |
| browser cannot run hand tracking | WebGL is off (turn on hardware acceleration) |
| hand tracking could not start | the tracker threw an error, the details line says which |

## What was tested with real hands

Three real hand photos (index extended, index half-curled, fist) were played through Chrome as a fake webcam with every
external network request blocked. In each case the app started the camera, tracked the hand, reported "Lighting OK / Hand found",
and read the finger states correctly (`eccc`, `hccc`, `cccc`). That checks the tracker, the normalization and the finger-state logic
on real landmarks. It does **not** measure letter accuracy: those photos are side views, and no real signers were tested.

## Honest status of the baseline classifier

`ruleClassify()` needs no training data. It reads finger states and thumb position and is tested against synthetic hands
(`recognition/pipeline.spec.ts`). It covers **A B C D F I K L M N O S T U V W X Y** (J and Z via the path rule).
It does **not** cover **E G H P Q R** (they need hand orientation or finer detail), and its thresholds (`TUNE` in `classifier.ts`)
were set without volunteer data. For the thesis accuracy targets, train on your volunteer and public-dataset samples.

## Plugging in your trained model

Option A, no ML framework: export normalized samples to `public/models/landmark-samples.json`:

```json
[ { "l": "A", "f": [0, 0, 0, 0.12, -0.5, 0.01, ...63 numbers...] }, ... ]
```

The 63 numbers must be produced exactly like `normalize()` above. Set `classifierSamplesUrl: 'models/landmark-samples.json'` in
the environment file. The app then uses k-nearest-neighbour (k = 5).

Option B, your own model (TF.js, ONNX): implement `LandmarkClassifier { classify(n: number[]): { label, confidence } }` and pass it
to `recognize(n, trained)` inside `CameraSource`. The look-alike rule, voting, builder and feedback keep working unchanged.

## Testing without a camera

The camera is allowed once. It keeps running from one sign to the next, and when the browser already allows it the practice page starts it by itself (`recognition/camera-permission.ts`).
It feeds the same engine, so voting, locking, hints, timers, saving and mastery all behave as with a real hand.
