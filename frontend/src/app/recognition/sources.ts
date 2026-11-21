import { environment } from '../../environments/environment';
import { Features, KnnClassifier, LandmarkClassifier, recognize } from './classifier';
import { LM, normalize, Pt } from './landmarks';
import { LightingIssue, lightingIssue, measure } from './lighting';
import { classifyPath, PathPoint } from './path-rule';

export type CameraProblem = 'insecure' | 'denied' | 'no-camera' | 'busy' | 'files' | 'webgl' | 'tracker' | 'unknown';
/** `detail` is the real underlying error, shown to the user so a problem is never hidden behind a vague message. */
export class CameraError extends Error {
  constructor(readonly problem: CameraProblem, message: string, readonly detail = '') { super(message); }
}

/** What one frame told us. landmarks are 0..1 picture coordinates (for drawing). */
export interface Observation { label: string | null; confidence: number; landmarks: Pt[] | null; features: Features | null; }
export interface ObservationSource {
  readonly kind: 'camera';
  start(): Promise<void>;
  stop(): void;
  /** Returns a new observation, or null when nothing new has arrived since the last call. */
  observe(): Observation | null;
}

const NO_HAND: Observation = { label: null, confidence: 0, landmarks: null, features: null };
/** MediaPipe Hands is served from this app (angular.json copies it), so tracking never needs the internet. */
const TRACKER_DIR = 'mediapipe/hands/';
const abs = (p: string) => new URL(p, document.baseURI).href; // Turns a relative path into a full URL.

export interface HandsResults { multiHandLandmarks?: Pt[][]; }
export type ImageSource = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap;
export interface HandsApi {
  setOptions(o: Record<string, unknown>): void;
  onResults(cb: (r: HandsResults) => void): void;
  initialize(): Promise<void>;
  send(i: { image: ImageSource }): Promise<void>;
  close(): Promise<void>;
}

// Loads a JavaScript file into the page and resolves when it is ready.
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

// Rejects a promise that takes longer than the given milliseconds.
const withTimeout = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} took longer than ${ms / 1000} s`)), ms))]);

/** Loads the bundled MediaPipe Hands tracker; shared by the camera and by file (photo/video) analysis. */
export async function createHands(onResults: (r: HandsResults) => void, maxNumHands = 1): Promise<HandsApi> {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
    throw new CameraError('webgl', 'This browser cannot run hand tracking.', 'WebGL is not available');
  }
  const script = abs(`${TRACKER_DIR}hands.js`);
  try {
    const r = await fetch(script, { cache: 'no-cache' });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || /html/.test(type)) throw new Error(`${script} answered ${r.status} ${type}`);
    if (!(window as unknown as { Hands?: unknown }).Hands) await loadScript(script);
  } catch (e) {
    throw new CameraError('files', 'The hand-tracking files are missing from this app.', (e as Error).message);
  }
  const Hands = (window as unknown as { Hands?: new (o: { locateFile: (f: string) => string }) => HandsApi }).Hands;
  if (!Hands) throw new CameraError('files', 'The hand-tracking files are missing from this app.', 'window.Hands is undefined after loading hands.js');
  try {
    const hands = new Hands({ locateFile: (f) => abs(TRACKER_DIR + f) });
    hands.setOptions({ maxNumHands, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.4, selfieMode: false });
    hands.onResults(onResults);
    await withTimeout(hands.initialize(), 45_000, 'Loading hand tracking');
    return hands;
  } catch (e) {
    throw new CameraError('tracker', 'Hand tracking could not start.', (e as Error).message ?? String(e));
  }
}

/** Webcam + hand tracking that runs fully on the learner's device; video is never uploaded. */
export class CameraSource implements ObservationSource {
  readonly kind = 'camera' as const;
  lighting: LightingIssue | null = null;
  brightness = 0;
  /** Set when tracking stops working after it started (for example the GPU was lost). */
  failure: CameraError | null = null;
  private stream: MediaStream | null = null;
  private hands: HandsApi | null = null;
  private trained: LandmarkClassifier | null = null;
  private running = false;
  private pending: Observation | null = null;
  private lightAt = 0;
  private canvas = document.createElement('canvas');
  private jPath: PathPoint[] = [];
  private zPath: PathPoint[] = [];
  private latch: { label: string; until: number } | null = null;

  // Remembers which <video> element the camera frames go to.
  constructor(private video: HTMLVideoElement) {}

  // Turns the camera on and loads the hand tracker.
  async start(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('insecure', 'The camera only works on https:// pages (or localhost).');
    }
    await this.openCamera();
    try {
      await this.loadTracker();
    } catch (e) {
      this.stop();
      throw e;
    }
    this.trained = !environment.classifierSamplesUrl ? null : await fetch(environment.classifierSamplesUrl)
      .then((r) => (r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() : null))
      .then((s) => (Array.isArray(s) && s.length ? new KnnClassifier(s) : null))
      .catch(() => null);
    this.running = true;
    void this.pump();
  }

  // Asks the browser for the camera and plays its video into the element.
  private async openCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) {
      const err = e as DOMException;
      const detail = `${err.name}: ${err.message}`;
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') throw new CameraError('denied', 'Camera permission was blocked.', detail);
      if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') throw new CameraError('no-camera', 'No camera was found.', detail);
      if (err.name === 'NotReadableError') throw new CameraError('busy', 'Another app is using the camera.', detail);
      throw new CameraError('unknown', 'The camera could not start.', detail);
    }
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    await this.video.play().catch(() => undefined);
  }

  /** Loads the bundled tracker and says exactly which part failed. */
  private async loadTracker(): Promise<void> {
    this.hands = await createHands((r) => this.onResults(r));
  }

  // Stops the camera, the tracker loop, and releases everything.
  stop(): void {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    const h = this.hands;
    this.hands = null;
    void h?.close().catch(() => undefined);
  }

  // Returns the newest finished observation and clears it.
  observe(): Observation | null {
    const o = this.pending;
    this.pending = null;
    return o;
  }

  /** Debug counters for diagnosing camera/tracking problems. */
  private dbg = { sends: 0, results: 0, skips: 0, rs: 0, t: 0, err: '' };
  // Sends each new camera frame to the tracker, one at a time.
  private async pump(): Promise<void> {
    let lastTime = -1;
    const debug = !!localStorage.getItem('signspell-debug');
    while (this.running && this.hands) {
      const v = this.video;
      if (debug) { this.dbg.rs = v.readyState; this.dbg.t = v.currentTime; (window as unknown as Record<string, unknown>)['__cam'] = this.dbg; }
      if (v.readyState >= 2 && v.videoWidth && v.currentTime !== lastTime) {
        lastTime = v.currentTime;
        this.dbg.sends++;
        try {
          await this.hands.send({ image: v });
          await this.nextFrame(); // always give the page a turn before the next detection
        } catch (e) {
          this.dbg.err = String((e as Error).message ?? e);
          if (this.running) this.failure = new CameraError('tracker', 'Hand tracking stopped working.', (e as Error).message ?? String(e));
          return;
        }
      } else {
        this.dbg.skips++;
        await this.nextFrame();
      }
    }
  }

  /** A short timer (not rAF or requestVideoFrameCallback, which never fire in hidden or headless pages). */
  private nextFrame(): Promise<void> {
    return new Promise((r) => setTimeout(r, 16));
  }

  // Handles one tracker result: measures light, classifies the hand, and stores the observation.
  private onResults(r: HandsResults): void {
    this.dbg.results++;
    const t = performance.now();
    this.sampleLight(t);
    const lm = r.multiHandLandmarks?.[0];
    if (!lm || lm.length !== 21) { this.jPath = []; this.zPath = []; this.pending = NO_HAND; return; }
    const raw: Pt[] = lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    const aspect = this.video.videoWidth / (this.video.videoHeight || 1);
    const n = normalize(raw, aspect);
    if (!n) { this.pending = { ...NO_HAND, landmarks: raw }; return; }
    const rec = recognize(n, this.trained);
    let { label, confidence } = rec;

    // Path rule: J is an I-hand that draws a hook, Z is a pointing finger that draws a zigzag.
    const palm = Math.hypot((raw[LM.MIDDLE_MCP].x - raw[LM.WRIST].x) * aspect, raw[LM.MIDDLE_MCP].y - raw[LM.WRIST].y) || 1;
    const track = (buf: PathPoint[], p: Pt) => { buf.push({ x: (p.x * aspect) / palm, y: p.y / palm, t }); while (buf.length && t - buf[0].t > 1500) buf.shift(); };
    const f = rec.features.fingers.join('');
    if (f === 'ccce') track(this.jPath, raw[LM.PINKY_TIP]); else this.jPath = [];
    if (f === 'eccc') track(this.zPath, raw[LM.INDEX_TIP]); else this.zPath = [];
    const drawn = classifyPath(this.jPath) === 'J' ? 'J' : classifyPath(this.zPath) === 'Z' ? 'Z' : null;
    if (drawn) { this.latch = { label: drawn, until: t + 1500 }; this.jPath = []; this.zPath = []; }
    if (this.latch && t < this.latch.until && (f === 'ccce' || f === 'eccc')) { label = this.latch.label; confidence = 0.85; }
    this.pending = { label, confidence, landmarks: raw, features: rec.features };
  }

  // Samples the camera picture every so often to check the lighting.
  private sampleLight(t: number): void {
    if (t - this.lightAt < 400) return;
    this.lightAt = t;
    const c = this.canvas; c.width = 32; c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(this.video, 0, 0, 32, 24);
    const m = measure(ctx.getImageData(0, 0, 32, 24).data);
    this.brightness = m.mean;
    this.lighting = lightingIssue(m.mean, m.contrast);
  }
}
