import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, ApiError } from '../../../core/api/api';
import { ConfirmService } from '../../../core/confirm.service';
import { Sign, SignType } from '../../../core/models';
import { FileTracker } from '../../../recognition/file-tracker';
import { ToastService } from '../../../core/toast.service';
import { HasUnsavedChanges } from '../../../core/unsaved.guard';
import { applyServerErrors, errorOf } from '../../../core/util/forms';
import { labelProblem, normalizeLabel } from '../../../core/util/sign-label';
import { HintRepository } from '../../../data/hint.repository';
import { LessonMediaRepository } from '../../../data/lesson-media.repository';
import { HintButton } from '../../../shared/hints/hint-button';
import { HintEditor } from '../../../shared/hints/hint-editor';
import { HintPanel } from '../../../shared/hints/hint-panel';
import { ImagePicker } from '../../../shared/image-picker/image-picker';
import { MediaItem } from '../../../shared/media/media-item';
import { imagesOf, videoOf } from '../../../shared/media/media-list';
import { MediaPreview } from '../../../shared/media/media-preview';
import { MediaUploader } from '../../../shared/media/media-uploader';
import { Modal } from '../../../shared/modal/modal';
import { Reveal } from '../../../shared/reveal';
import { Slider } from '../../../shared/slider';

/** What the Type buttons show, plus the plain-language rule that appears when the label is not valid for that type. */
const TYPES: { id: SignType; label: string; hint: string; problem: string }[] = [
  { id: 'letter', label: 'Letter', hint: 'One letter, for example B.', problem: 'Type one letter from A to Z.' },
  { id: 'word', label: 'Word', hint: '2 to 12 letters, for example HELLO.', problem: 'Use 2 to 12 letters from A to Z, with no spaces.' },
  { id: 'sentence', label: 'Sentence', hint: '2 to 5 words, for example I AM HERE.', problem: 'Use 2 to 5 words, with letters from A to Z only.' },
];

/** A short summary of what a donated sign has beyond its first picture, for the badges on the shelf. */
interface Extras { pictures: number; video: boolean; }

/** Teacher studio for donating signs: pick type and label, add pictures/video, write a hint, and submit. */
@Component({
  selector: 'app-donate',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, ImagePicker, MediaUploader, MediaPreview, HintEditor, HintButton, HintPanel, Modal, Reveal, Slider],
  templateUrl: './donate.html',
  styleUrl: './donate.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Donate implements HasUnsavedChanges, OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly hints = inject(HintRepository);
  private readonly lessonMedia = inject(LessonMediaRepository);
  private readonly picker = viewChild(ImagePicker);

  readonly types = TYPES;
  readonly err = errorOf;
  readonly form = inject(NonNullableFormBuilder).group({
    signType: ['word' as SignType],
    label: ['', [Validators.required]],
  });

  // ---------- the sign being prepared ----------
  /** The single picture of a LETTER. */
  readonly image = signal<File | null>(null);
  /** A temporary local address for that picture, so the preview can show it. */
  readonly letterUrl = signal<string | null>(null);
  /**
   * The pictures (in order) and the video of a WORD or SENTENCE. The order here is the order a learner will follow.
   * Each MediaItem has the shape the backend will eventually receive: { id, type, url, previewUrl, sequence, file }.
   */
  readonly media = signal<MediaItem[]>([]);
  /** The hint text typed so far. It is saved together with the sign when the teacher donates it. */
  readonly hintDraft = signal('');
  /** Whether the learner-side hint is open in the preview (so the teacher can try it). */
  readonly hintOpen = signal(false);
  readonly imageError = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  // Keeps the form value as a signal so the preview and the step marks update as the teacher types.
  private readonly typed = signal({ signType: 'word' as SignType, label: '' });
  readonly signType = computed(() => this.typed().signType);
  readonly isLetter = computed(() => this.signType() === 'letter');
  readonly typeInfo = computed(() => TYPES.find((t) => t.id === this.signType())!);
  /** The label as it will be stored (capital letters, single spaces). */
  readonly previewLabel = computed(() => normalizeLabel(this.typed().label));

  /** What the preview plays: the single letter picture, or the word/sentence media. */
  readonly previewItems = computed<MediaItem[]>(() => {
    if (!this.isLetter()) return this.media();
    const url = this.letterUrl();
    return url ? [{ id: 'letter', type: 'image', name: this.previewLabel() || 'letter', url, previewUrl: url, sequence: 1, file: this.image() }] : [];
  });
  /** Which of the three steps already has something in it (shown as a tick next to the step title). */
  readonly done = computed(() => ({ content: !!this.previewLabel(), media: this.previewItems().length > 0, hint: !!this.hintDraft().trim() }));

  // ---------- the teacher's donated signs ----------
  readonly mine = signal<Sign[]>([]);
  readonly loading = signal(true);
  /** Hints by sign id, for the "Hint" badge on the shelf. */
  readonly hintsById = signal<Record<string, string>>({});
  /** How many pictures and whether there is a video, by sign id. */
  readonly extras = signal<Record<string, Extras>>({});
  /** The donated sign whose hint is being edited in the dialog, or null when the dialog is closed. */
  readonly editing = signal<Sign | null>(null);
  /** True while MediaPipe is reading the uploaded media and Gemini is checking it. */
  readonly analyzing = signal(false);
  /** What Gemini recognized in the uploaded media, shown under the studio after a donation. */
  readonly aiGuess = signal('');
  private tracker: FileTracker | null = null;

  // Subscribes the form to the typed signal and loads the teacher's signs.
  async ngOnInit(): Promise<void> {
    // Keep the signal copy of the form in step with the form itself.
    this.form.valueChanges.subscribe((v) => this.typed.set({ signType: v.signType ?? 'word', label: v.label ?? '' }));
    await this.loadMine();
  }

  // Frees the temporary picture URL when leaving the page.
  ngOnDestroy(): void {
    // The temporary picture address is no longer needed once the page is closed.
    const url = this.letterUrl();
    if (url) URL.revokeObjectURL(url);
  }

  // Switches the sign type and clears related errors.
  setType(type: SignType): void {
    this.form.controls.signType.setValue(type);
    this.form.controls.label.setErrors(null);
    this.imageError.set('');
    this.hintOpen.set(false);
  }

  /** A letter's single picture was chosen (or cleared) in the picture box. */
  onLetterPicked(file: File | null): void {
    const old = this.letterUrl();
    if (old) URL.revokeObjectURL(old);
    this.image.set(file);
    this.letterUrl.set(file ? URL.createObjectURL(file) : null);
    this.imageError.set('');
  }

  /** The media list changed (a picture or the video was added, moved or removed). */
  onMediaChange(items: MediaItem[]): void {
    this.media.set(items);
    this.imageError.set('');
  }

  // Loads the teacher's donated signs plus their hint/media badges.
  private async loadMine(): Promise<void> {
    try {
      const signs = (await this.api.listSigns({ mine: true })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.mine.set(signs);
      // BACKEND INTEGRATION POINT: hints and extra media are read from the frontend repositories today.
      this.hintsById.set(await this.hints.getAll());
      const extras: Record<string, Extras> = {};
      for (const s of signs.filter((x) => x.signType !== 'letter')) {
        const items = await this.lessonMedia.get(s.signId);
        if (items.length) extras[s.signId] = { pictures: imagesOf(items).length, video: !!videoOf(items) };
      }
      this.extras.set(extras);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** True while a sign is half made: a label, a picture or a hint was entered and not yet donated. */
  hasUnsavedChanges(): boolean {
    return !!(this.previewLabel() || this.image() || this.media().length || this.hintDraft().trim());
  }
  // Warns the browser before leaving with unsaved changes.
  @HostListener('window:beforeunload', ['$event'])
  warn(e: BeforeUnloadEvent): void { if (this.hasUnsavedChanges()) e.preventDefault(); }

  /** The sign that was already created by an earlier try whose pictures or hint then failed to save, so a retry continues instead of creating it twice. */
  private partial: { id: string; key: string } | null = null;

  // Validates the form, creates the sign, then saves its media and hint.
  async submit(): Promise<void> {
    this.error.set(''); this.imageError.set('');
    const { signType, label } = this.form.getRawValue();

    // The first picture is the one the existing sign API stores. For a word or sentence it is the START picture.
    const firstPicture = this.isLetter() ? this.image() : (imagesOf(this.media())[0]?.file ?? null);

    const problem = labelProblem(signType, label) ? this.typeInfo().problem : null;
    if (problem) this.form.controls.label.setErrors({ server: problem });
    if (!firstPicture) this.imageError.set(this.isLetter() ? 'Choose a picture of the sign.' : 'Add at least one picture. The first one is the start picture.');
    this.form.markAllAsTouched();
    if (problem || !firstPicture) return;

    this.busy.set(true);
    try {
      const key = `${signType}:${normalizeLabel(label)}`;
      let signId = this.partial?.key === key ? this.partial.id : null;
      let shown = normalizeLabel(label);
      if (!signId) {
        const sign = await this.api.createSign({ signType, label: shown, image: firstPicture });
        signId = sign.signId; shown = sign.label;
        this.partial = { id: signId, key };
      }

      // The sign exists now. If its pictures or hint fail, the person can press the button again and it carries on from here.
      try {
        if (!this.isLetter() && this.media().length) await this.lessonMedia.save(signId, this.media());
        if (this.hintDraft().trim()) await this.hints.save(signId, this.hintDraft());
      } catch (e) {
        this.error.set(`“${shown}” was added, but its pictures or hint could not be saved: ${(e as Error).message} Press the button again to try again.`);
        await this.loadMine();
        return;
      }
      this.partial = null;
      this.aiGuess.set('');

      this.toast.ok(`Thank you! “${shown}” was added.`);
      // Read the uploaded media on this device (MediaPipe landmarks) and ask Gemini what it saw; failures never undo the donation.
      void this.captureAndAnalyze(signId);
      this.resetForm();
      await this.loadMine();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) applyServerErrors(this.form, e.fields);
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Extracts hand landmarks from each uploaded file on this device, saves them as sign samples, then asks Gemini what sequence it saw. */
  private async captureAndAnalyze(signId: string): Promise<void> {
    // Pictures become one-frame samples; a video becomes one multi-frame sequence sample.
    const jobs: { file: File; seq: string }[] = [];
    if (this.isLetter() && this.image()) jobs.push({ file: this.image()!, seq: 'photo' });
    else {
      const video = this.media().find((m) => m.type === 'video' && m.file);
      if (video?.file) jobs.push({ file: video.file, seq: 'video' });
      this.media().filter((m) => m.type === 'image' && m.file).forEach((m, i) => jobs.push({ file: m.file!, seq: `step${i + 1}` }));
    }
    if (!jobs.length) return;

    this.analyzing.set(true);
    try {
      this.tracker ??= new FileTracker();
      for (const job of jobs) {
        const { frames } = await this.tracker.extract(job.file);
        await this.api.addSignSample(signId, {
          source: 'teacher_upload',
          sourceSequenceId: `${signId}:${job.seq}`,
          landmarks: frames,
          frameCount: frames.length,
        });
      }
      const analysis = await this.api.analyzeSignMedia(signId);
      this.aiGuess.set(analysis.labels.length ? analysis.labels.join(' → ') : '');
      if (analysis.labels.length) this.toast.ok(`AI check: it looks like ${analysis.labels.join(', ')}.`);
    } catch (e) {
      this.toast.error(`The sign was saved, but the AI check failed: ${(e as Error).message}`);
    } finally {
      this.analyzing.set(false);
      this.tracker?.close();
      this.tracker = null;
    }
  }

  /** Clears the studio for the next sign. (The temporary picture addresses are kept: the repository still shows them.) */
  private resetForm(): void {
    this.form.controls.label.reset('');
    this.image.set(null);
    this.letterUrl.set(null);
    this.picker()?.clear();
    this.media.set([]);
    this.hintDraft.set('');
    this.hintOpen.set(false);
  }

  // ---------- editing the hint of an already donated sign ----------
  /** Saves the hint typed in the dialog. */
  async saveHint(sign: Sign, text: string): Promise<void> {
    // BACKEND INTEGRATION POINT: this currently updates the frontend repository only.
    await this.hints.save(sign.signId, text);
    this.hintsById.set(await this.hints.getAll());
    this.toast.ok('Hint saved.');
    this.editing.set(null);
  }

  // Removes the hint of a donated sign after asking first.
  async removeHint(sign: Sign): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Remove this hint?', message: `The hint for “${sign.label}” will be deleted.`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    // BACKEND INTEGRATION POINT: this currently updates the frontend repository only.
    await this.hints.remove(sign.signId);
    this.hintsById.set(await this.hints.getAll());
    this.toast.ok('Hint removed.');
    this.editing.set(null);
  }
}
