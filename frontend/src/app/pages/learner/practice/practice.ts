import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/api';
import { AttemptInput, Mastery, Sign } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { CUES, hintFor } from '../../../recognition/hints';
import { EngineEvent, LIMIT_MS, PracticeEngine } from '../../../recognition/engine';
import { LIGHTING_TEXT, VISIBILITY_TEXT, visibilityIssue } from '../../../recognition/lighting';
import { HintRepository } from '../../../data/hint.repository';
import { LessonMediaRepository } from '../../../data/lesson-media.repository';
import { HintButton } from '../../../shared/hints/hint-button';
import { HintPanel } from '../../../shared/hints/hint-panel';
import { MediaItem } from '../../../shared/media/media-item';
import { MediaPreview } from '../../../shared/media/media-preview';
import { cameraAllowed, forgetCamera, rememberCamera } from '../../../recognition/camera-permission';
import { CameraError, CameraProblem, CameraSource, Observation } from '../../../recognition/sources';
import { EDGES } from '../../../shared/hand/hand';
import { MasteryBadge } from '../../../shared/mastery-badge/mastery-badge';
import { Reveal } from '../../../shared/reveal';

type Phase = 'loading' | 'ready' | 'starting' | 'running' | 'done' | 'timeout' | 'missing';
const PROBLEMS: Record<CameraProblem, { title: string; text: string }> = {
  insecure: { title: 'The camera needs a secure page', text: 'Open SignSpell with https:// (or on localhost). Browsers block the camera on plain http pages.' },
  denied: { title: 'Camera permission is blocked', text: 'Allow the camera for this site in your browser settings (tap the lock icon in the address bar), then try again.' },
  'no-camera': { title: 'No camera found', text: 'Connect a camera, then try again.' },
  busy: { title: 'The camera is busy', text: 'Close other apps or tabs that use the camera, then try again.' },
  files: { title: 'Hand-tracking files are missing', text: 'They ship inside this app. Run npm install, then restart ng serve (or rebuild) so they are copied.' },
  webgl: { title: 'This browser cannot run hand tracking', text: 'Turn on hardware acceleration in your browser settings, update your browser, or try Chrome.' },
  tracker: { title: 'Hand tracking could not start', text: 'Reload the page and try again. If it keeps failing, send the technical details below to your developer.' },
  unknown: { title: 'The camera could not start', text: 'Try again. If it keeps failing, reload the page.' },
};
/** The camera overlay is drawn on a canvas, which cannot use CSS variables directly, so it reads their values from the stylesheet. */
const COLOR_VAR = { ok: '--cam-ok', bad: '--cam-bad', none: '--cam-none' } as const;
const cssColor = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Practice screen: camera detects hand signs, gives green/red feedback, and saves attempts. */
@Component({
  selector: 'app-practice',
  standalone: true,
  imports: [RouterLink, MasteryBadge, HintButton, HintPanel, MediaPreview, Reveal],
  templateUrl: './practice.html',
  styleUrl: './practice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Practice implements OnDestroy {
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly hints = inject(HintRepository);
  private readonly lessonMedia = inject(LessonMediaRepository);
  /** The hint the TEACHER wrote for this sign, or null. (Separate from the live corrections the camera gives while practicing.) */
  readonly teacherHint = signal<string | null>(null);
  /** Whether the learner has opened the teacher's hint. It closes again whenever the sign changes. */
  readonly hintOpen = signal(false);
  /** The teacher's extra pictures (in order) and video for a word or sentence. */
  readonly lessonItems = signal<MediaItem[]>([]);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('overlay');

  readonly phase = signal<Phase>('loading');
  readonly sign = signal<Sign | null>(null);
  readonly letters = signal<Sign[]>([]);
  readonly siblings = signal<Sign[]>([]);
  readonly mastery = signal<Mastery | null>(null);
  readonly problem = signal<{ title: string; text: string; detail: string } | null>(null);
  readonly kind = signal<'camera' | null>(null);

  readonly feedback = signal<'none' | 'ok' | 'bad'>('none');
  readonly hint = signal('');
  readonly guidance = signal('');
  readonly lightingOk = signal<boolean | null>(null);
  readonly handSeen = signal(false);
  readonly live = signal<string | null>(null);
  readonly progress = signal(0);
  readonly pos = signal(0);
  readonly wrongAt = signal(-1);
  readonly needsSpace = signal(false);
  readonly seconds = signal(0);
  readonly saved = signal(0);
  readonly pendingCount = signal(0);
  readonly result = signal<{ ok: boolean; seconds: number } | null>(null);

  readonly mode = computed(() => this.sign()?.signType ?? 'letter');
  readonly chars = computed(() => (this.sign()?.label ?? '').split(''));
  readonly limit = computed(() => LIMIT_MS[this.mode()] / 1000);
  readonly remaining = computed(() => Math.max(0, this.limit() - this.seconds()));
  readonly expected = computed(() => this.chars()[this.pos()] ?? null);
  readonly refs = computed(() => {
    const byLabel = new Map(this.letters().map((s) => [s.label, s]));
    return this.chars().map((c, i) => ({ ch: c, sign: byLabel.get(c) ?? null, i }));
  });
  readonly current = computed(() => this.refs().find((r) => r.i === this.pos()) ?? this.refs()[0] ?? null);
  readonly cue = computed(() => (this.expected() && CUES[this.expected()!]) || '');
  readonly nextId = computed(() => {
    const list = this.siblings();
    const i = list.findIndex((s) => s.signId === this.sign()?.signId);
    return i >= 0 && i < list.length - 1 ? list[i + 1].signId : null;
  });
  readonly goal = computed(() => ({ letter: 'Hold the sign steady for about one second.', word: 'Spell the word in under 60 seconds.', sentence: 'Spell the sentence in under 3 minutes.' })[this.mode()]);
  readonly timeText = computed(() => `${Math.floor(this.remaining() / 60)}:${String(this.remaining() % 60).padStart(2, '0')}`);

  private src: CameraSource | null = null;
  private engine: PracticeEngine | null = null;
  private raf = 0;
  private startedAt: number | null = null;
  private feedbackUntil = 0;
  private confSum = 0;
  private confN = 0;
  private pending: AttemptInput[] = [];
  private loadToken = 0;

  // Reloads everything whenever the sign id input changes.
  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  // Stops the camera and cancels animations.
  ngOnDestroy(): void { this.stopAll(); }

  // ---------- loading ----------
  // Fetches the sign, letters, siblings, and mastery, then starts or waits for the camera.
  private async load(id: string): Promise<void> {
    const token = ++this.loadToken;
    cancelAnimationFrame(this.raf); this.raf = 0; // the camera itself keeps running for the next sign
    this.phase.set('loading');
    try {
      const sign = await this.api.getSign(id);
      const [letters, siblings, mastery] = await Promise.all([
        this.api.listSigns({ type: 'letter' }),
        sign.signType === 'letter' ? Promise.resolve<Sign[]>([]) : this.api.listSigns({ type: sign.signType }),
        this.api.myMastery(),
      ]);
      if (token !== this.loadToken) return;
      this.sign.set(sign);
      // BACKEND INTEGRATION POINT: the teacher's hint and extra media come from the frontend repositories today.
      this.hintOpen.set(false);
      this.teacherHint.set(await this.hints.get(sign.signId));
      this.lessonItems.set(sign.signType === 'letter' ? [] : await this.lessonMedia.get(sign.signId));
      this.letters.set(letters);
      this.siblings.set(sign.signType === 'letter' ? letters : siblings);
      this.mastery.set(mastery.find((m) => m.signId === id) ?? null);
      this.engine = new PracticeEngine(sign.label, sign.signType);
      this.resetRound();
      if (this.src) {
        // already allowed and running: go straight on with the next sign, no button, no question
        this.guidance.set('Show one hand to the camera.');
        this.phase.set('running');
        this.raf = requestAnimationFrame(this.loop);
      } else {
        this.phase.set('ready');
        void this.autoStart(token);
      }
    } catch {
      if (token === this.loadToken) this.phase.set('missing');
    }
  }

  // Resets the engine, timers, and all feedback for a new round.
  private resetRound(): void {
    this.engine?.reset();
    this.startedAt = null; this.feedbackUntil = 0; this.confSum = 0; this.confN = 0;
    this.feedback.set('none'); this.hint.set(''); this.pos.set(0); this.wrongAt.set(-1); this.needsSpace.set(false);
    this.seconds.set(0); this.progress.set(0); this.live.set(null); this.result.set(null);
  }

  // ---------- starting and stopping ----------
  /** If the browser already allows the camera, start it without a click (and without asking again). */
  private async autoStart(token: number): Promise<void> {
    if (!(await cameraAllowed())) return;
    for (let i = 0; i < 40 && !this.video(); i++) await new Promise((r) => setTimeout(r, 25)); // wait for the <video> to exist
    if (token !== this.loadToken || this.phase() !== 'ready' || this.src) return;
    await this.start();
  }

  // Starts the camera and begins the practice round.
  async start(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video || !this.engine) return;
    this.problem.set(null);
    this.phase.set('starting');
    this.stopSource();
    const src = new CameraSource(video);
    try {
      await src.start();
    } catch (e) {
      src.stop();
      const err = e instanceof CameraError ? e : null;
      if (err?.problem === 'denied') forgetCamera();
      this.problem.set({ ...PROBLEMS[err?.problem ?? 'unknown'], detail: err?.detail || (e as Error)?.message || '' });
      this.phase.set('ready');
      return;
    }
    rememberCamera();
    this.src = src;
    this.kind.set('camera');
    this.resetRound();
    this.phase.set('running');
    this.guidance.set('Show one hand to the camera.');
    this.raf = requestAnimationFrame(this.loop);
  }

  // Resets the round and resumes the running camera.
  again(): void {
    if (!this.src) return;
    this.resetRound();
    this.phase.set('running');
    this.raf = requestAnimationFrame(this.loop);
  }

  // Stops the camera source only.
  private stopSource(): void { this.src?.stop(); this.src = null; this.kind.set(null); }
  // Stops the camera and cancels the frame loop.
  private stopAll(): void { cancelAnimationFrame(this.raf); this.raf = 0; this.stopSource(); }

  // ---------- the frame loop ----------
  // The per-frame loop: observes the camera, updates UI, and schedules the next frame.
  private readonly loop = (now: number): void => {
    this.raf = 0;
    if (!this.src || this.phase() !== 'running') return;
    const failure = this.src.failure;
    if (failure) { this.stopAll(); this.problem.set({ ...PROBLEMS[failure.problem], detail: failure.detail }); this.phase.set('ready'); return; }
    const obs = this.src.observe();
    if (obs) this.frame(now, obs);
    if (this.phase() === 'running') this.raf = requestAnimationFrame(this.loop);
  };

  // Processes one camera observation: timer, engine step, guidance, drawing, events.
  private frame(t: number, obs: Observation): void {
    const engine = this.engine!;
    if (this.startedAt === null && obs.label) this.startedAt = t; // the timer starts at the first sign
    const elapsed = this.startedAt === null ? 0 : t - this.startedAt;
    this.seconds.set(Math.floor(elapsed / 1000));
    const limit = LIMIT_MS[this.mode()];
    if (limit && elapsed >= limit) { this.finish(false, elapsed); return; }

    const tick = engine.step(t, { label: obs.label, confidence: obs.confidence });
    this.live.set(obs.label);
    if (localStorage.getItem('signspell-debug')) (window as unknown as Record<string, unknown>)['__lastObs'] = { label: obs.label, confidence: obs.confidence, fingers: obs.features?.fingers, ratios: obs.features?.ratios, thumb: obs.features?.thumb, gapIM: obs.features?.gapIM, hand: !!obs.landmarks };
    this.progress.set(Math.round(tick.vote.progress * 100) / 100);
    this.handSeen.set(!!obs.landmarks);
    this.needsSpace.set(engine.builder.needsSpace && this.mode() === 'sentence');
    this.updateGuidance(obs);
    this.draw(obs);
    if (tick.event) this.onEvent(t, tick.event, obs, elapsed);
    if (this.feedbackUntil && t > this.feedbackUntil) { this.feedback.set('none'); this.wrongAt.set(-1); this.feedbackUntil = 0; }
  }

  // Picks the best guidance message for the current observation (lighting, visibility, or progress).
  private updateGuidance(obs: Observation): void {
    const cam = this.src;
    if (!cam) return;
    this.lightingOk.set(!cam.lighting);
    if (cam.lighting) return this.guidance.set(LIGHTING_TEXT[cam.lighting]);
    const vis = visibilityIssue(obs.landmarks);
    if (vis) return this.guidance.set(VISIBILITY_TEXT[vis]);
    this.guidance.set(obs.label ? `I see ${obs.label}. Hold it steady.` : 'Hand found. Make the sign.');
  }

  // Handles a correct/wrong engine event: feedback, hint, and saving the attempt.
  private onEvent(t: number, ev: EngineEvent, obs: Observation, elapsed: number): void {
    const engine = this.engine!;
    const ok = ev.type === 'correct';
    this.feedback.set(ok ? 'ok' : 'bad');
    this.feedbackUntil = t + (ok ? 1400 : 2800);
    this.pos.set(engine.builder.position);
    this.wrongAt.set(ok ? -1 : engine.builder.position);
    this.confSum += ev.confidence; this.confN++;
    this.hint.set(ok ? '' : hintFor(ev.expected, ev.label, obs.features));

    // Every confirmed letter counts toward that letter's own mastery.
    const letter = ok ? ev.label : ev.expected;
    const letterSign = this.mode() === 'letter' ? this.sign() : this.letters().find((s) => s.label === letter);
    if (letterSign) void this.save({ signId: letterSign.signId, predictedLabel: ev.label, confidence: ev.confidence, isCorrect: ok });
    if (ok && ev.complete) this.finish(true, elapsed);
  }

  // Confirms a space in a sentence when the engine says one is needed.
  space(): void {
    const engine = this.engine;
    if (this.phase() !== 'running' || !engine || !engine.pressSpace()) return;
    this.pos.set(engine.builder.position);
    this.needsSpace.set(false);
    (document.activeElement as HTMLElement | null)?.classList.contains('space') && (document.activeElement as HTMLElement).blur();
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key !== ' ' || this.mode() !== 'sentence' || this.phase() !== 'running') return;
    // Typing in a field, or pressing space on some other button/link, keeps its normal meaning.
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('button, a, input, select, textarea');
    if (el && !(el.classList.contains('space') || (el as HTMLButtonElement).disabled)) return;
    e.preventDefault();
    this.space();
  }

  // Ends the round, saves the final attempt for words/sentences, and shows the result.
  private finish(ok: boolean, elapsedMs: number): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    const sign = this.sign()!;
    const secs = Math.round(elapsedMs / 100) / 10;
    this.result.set({ ok, seconds: secs });
    this.phase.set(ok ? 'done' : 'timeout');
    this.progress.set(0);
    if (this.mode() !== 'letter') {
      const built = this.engine!.builder.built.trim();
      void this.save({ signId: sign.signId, predictedLabel: built || '-', confidence: this.confN ? this.confSum / this.confN : 0, isCorrect: ok });
    }
    const c = this.canvas()?.nativeElement;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }

  // ---------- saving ----------
  // Queues an attempt and sends the pending batch.
  private async save(a: AttemptInput): Promise<void> {
    this.pending.push(a);
    await this.flush();
  }
  // Sends all queued attempts, re-queuing any that fail.
  async flush(): Promise<void> {
    const batch = this.pending.splice(0);
    for (const x of batch) {
      try {
        const r = await this.api.recordAttempt(x);
        this.saved.update((n) => n + 1);
        if (r.mastery.signId === this.sign()?.signId) this.mastery.set(r.mastery);
      } catch (e) {
        this.pending.push(x);
        if (this.pending.length === 1) this.toast.error(`Could not save an attempt: ${(e as Error).message}`);
      }
    }
    this.pendingCount.set(this.pending.length);
  }

  // ---------- drawing ----------
  // Draws the detected hand skeleton on the overlay canvas.
  private draw(obs: Observation): void {
    const v = this.video()?.nativeElement, c = this.canvas()?.nativeElement;
    const ctx = c?.getContext('2d');
    if (!v || !c || !ctx) return;
    if (!obs.landmarks || !v.videoWidth) { ctx.clearRect(0, 0, c.width, c.height); return; }
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const lm = obs.landmarks;
    const color = cssColor(COLOR_VAR[this.feedback()]);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, c.width / 220); ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of EDGES) { ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height); ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height); }
    ctx.stroke();
    for (const p of lm) { ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, ctx.lineWidth * 1.5, 0, 6.2832); ctx.fill(); }
  }

  // Returns the word/sentence text built so far.
  engineBuilt(): string { return this.engine?.builder.built ?? ''; }
  // Formats the learner's average accuracy as a percentage.
  accuracy(): string { const m = this.mastery(); return m ? `${Math.round(m.correctAvg * 100)}%` : '–'; }
}
