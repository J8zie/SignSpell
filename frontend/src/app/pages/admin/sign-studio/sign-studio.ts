import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ApiError } from '../../../core/api/api';
import { Account, Sign, SignType, fullName } from '../../../core/models';
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
import { imagesOf } from '../../../shared/media/media-list';
import { MediaPreview } from '../../../shared/media/media-preview';
import { MediaUploader } from '../../../shared/media/media-uploader';
import { Reveal } from '../../../shared/reveal';
import { Slider } from '../../../shared/slider';

/** What the Type buttons show, plus the plain-language rule that appears when the label is not valid for that type. */
const TYPES: { id: SignType; label: string; hint: string; problem: string }[] = [
  { id: 'letter', label: 'Letter', hint: 'One letter, for example B.', problem: 'Type one letter from A to Z.' },
  { id: 'word', label: 'Word', hint: '2 to 12 letters, for example HELLO.', problem: 'Use 2 to 12 letters from A to Z, with no spaces.' },
  { id: 'sentence', label: 'Sentence', hint: '2 to 5 words, for example I AM HERE.', problem: 'Use 2 to 5 words, with letters from A to Z only.' },
];

/** Admin screen for creating a new sign or editing an existing one, including media, hint, and owner. */
@Component({
  selector: 'app-sign-studio',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ImagePicker, MediaUploader, MediaPreview, HintEditor, HintButton, HintPanel, Reveal, Slider],
  templateUrl: './sign-studio.html',
  styleUrl: './sign-studio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignStudio implements OnInit, OnDestroy, HasUnsavedChanges {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly hints = inject(HintRepository);
  private readonly lessonMedia = inject(LessonMediaRepository);
  private readonly picker = viewChild(ImagePicker);

  /** The sign being changed. It comes from the address (/admin/signs/:id/edit); with no id the studio makes a new sign. */
  readonly id = input<string>();
  readonly editing = computed(() => !!this.id());

  readonly types = TYPES;
  readonly err = errorOf;
  readonly name = fullName;
  readonly form = inject(NonNullableFormBuilder).group({
    signType: ['letter' as SignType],
    label: ['', [Validators.required]],
    ownerId: [''],
  });

  /** What the sign looked like when it was opened, so "unsaved changes" means a real difference. */
  private initialMedia = '';
  private initialHint = '';
  private saved = false;
  /** True when this screen just created the sign (so a failed retry can explain what already happened). */
  private created = false;

  readonly teachers = signal<Account[]>([]);
  readonly loading = signal(true);
  /** The sign as it was when opened for editing. */
  private readonly original = signal<Sign | null>(null);

  // ---------- the sign being prepared ----------
  readonly image = signal<File | null>(null);
  readonly letterUrl = signal<string | null>(null);
  readonly media = signal<MediaItem[]>([]);
  readonly hintDraft = signal('');
  readonly hintOpen = signal(false);
  readonly imageError = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  private readonly typed = signal({ signType: 'letter' as SignType, label: '' });
  readonly signType = computed(() => this.typed().signType);
  readonly isLetter = computed(() => this.signType() === 'letter');
  readonly typeInfo = computed(() => TYPES.find((t) => t.id === this.signType())!);
  readonly previewLabel = computed(() => normalizeLabel(this.typed().label));
  /** The picture the sign already has, shown until a new one is chosen. */
  readonly existingUrl = computed(() => this.original()?.imageUrl ?? null);

  readonly previewItems = computed<MediaItem[]>(() => {
    if (!this.isLetter()) return this.media();
    const url = this.letterUrl() ?? this.existingUrl();
    return url ? [{ id: 'letter', type: 'image', name: this.previewLabel() || 'letter', url, previewUrl: url, sequence: 1, file: this.image() }] : [];
  });
  readonly done = computed(() => ({ content: !!this.previewLabel(), media: this.previewItems().length > 0, hint: !!this.hintDraft().trim() }));

  // Loads teachers, then opens the sign if editing.
  async ngOnInit(): Promise<void> {
    this.form.valueChanges.subscribe((v) => this.typed.set({ signType: v.signType ?? 'letter', label: v.label ?? '' }));
    try {
      this.teachers.set(await this.api.listAccounts({ role: 'teacher' }));
    } catch { /* the owner list is optional */ }
    const id = this.id();
    if (id) await this.open(id);
    this.loading.set(false);
  }

  // Frees the temporary picture URL when leaving the page.
  ngOnDestroy(): void {
    const url = this.letterUrl();
    if (url) URL.revokeObjectURL(url);
  }

  /** Loads an existing sign, its pictures and its hint into the studio. */
  private async open(id: string): Promise<void> {
    try {
      const sign = await this.api.getSign(id);
      this.original.set(sign);
      this.form.reset({ signType: sign.signType, label: sign.label, ownerId: sign.userOwnershipId ?? '' });
      this.typed.set({ signType: sign.signType, label: sign.label });
      // BACKEND INTEGRATION POINT: hints and extra media are read from the frontend repositories today.
      this.hintDraft.set((await this.hints.get(id)) ?? '');
      this.initialHint = this.hintDraft();
      if (sign.signType !== 'letter') {
        const saved = await this.lessonMedia.get(id);
        if (saved.length) this.media.set(saved);
        else if (sign.imageUrl) this.media.set([{ id: 'current', type: 'image', name: 'Current picture', url: sign.imageUrl, previewUrl: sign.imageUrl, sequence: 1, file: null }]);
      }
      this.initialMedia = this.mediaSignature();
    } catch (e) {
      this.saved = true; // nothing was changed, so no "leave without saving?" on the way out
      this.toast.error((e as Error).message);
      await this.router.navigateByUrl('/admin/signs');
    }
  }

  // Builds a short signature of the media list to detect changes.
  private mediaSignature(): string { return this.media().map((m) => `${m.id}:${m.file ? 'new' : 'saved'}`).join('|'); }

  /** True when something was typed, chosen or reordered since the sign was opened (or anything at all for a new sign). */
  hasUnsavedChanges(): boolean {
    if (this.saved) return false;
    return this.form.dirty || !!this.image() || this.mediaSignature() !== this.initialMedia || this.hintDraft().trim() !== this.initialHint.trim();
  }
  // Warns the browser before leaving with unsaved changes.
  @HostListener('window:beforeunload', ['$event'])
  warn(e: BeforeUnloadEvent): void { if (this.hasUnsavedChanges()) e.preventDefault(); }

  // Switches the sign type and clears related errors.
  setType(type: SignType): void {
    this.form.controls.signType.setValue(type);
    this.form.controls.signType.markAsDirty();
    this.form.controls.label.setErrors(null);
    this.imageError.set('');
    this.hintOpen.set(false);
  }

  // Handles a letter's single picture being chosen or cleared.
  onLetterPicked(file: File | null): void {
    const old = this.letterUrl();
    if (old) URL.revokeObjectURL(old);
    this.image.set(file);
    this.letterUrl.set(file ? URL.createObjectURL(file) : null);
    this.imageError.set('');
  }

  // Updates the media list when pictures or video change.
  onMediaChange(items: MediaItem[]): void {
    this.media.set(items);
    this.imageError.set('');
  }

  // Validates the form, saves the sign, then saves its media, hint, and owner.
  async submit(): Promise<void> {
    this.error.set(''); this.imageError.set('');
    const { signType, label, ownerId } = this.form.getRawValue();
    const letter = signType === 'letter';
    const firstPicture = letter ? this.image() : (imagesOf(this.media())[0]?.file ?? null);
    const hasPicture = letter ? !!(this.image() || this.existingUrl()) : this.media().some((m) => m.type === 'image');

    const problem = labelProblem(signType, label) ? this.typeInfo().problem : null;
    if (problem) this.form.controls.label.setErrors({ server: problem });
    if (!hasPicture) this.imageError.set(letter ? 'Choose a picture of the sign.' : 'Add at least one picture. The first one is the start picture.');
    this.form.markAllAsTouched();
    if (problem || !hasPicture) return;

    this.busy.set(true);
    try {
      const input = { signType, label: normalizeLabel(label), ownerId: ownerId || null, image: firstPicture };
      let orig = this.original();
      const sign = orig ? await this.api.updateSign(orig.signId, input) : await this.api.createSign(input);
      // From here on this is an edit of a sign that exists, so a retry after a failure never tries to create it twice.
      if (!orig) { this.original.set(sign); orig = sign; this.created = true; }

      // BACKEND INTEGRATION POINT: the extra pictures, the video and the hint go to the frontend repositories today.
      if (!letter && this.media().length) await this.lessonMedia.save(sign.signId, this.media());
      else if (orig) await this.lessonMedia.remove(sign.signId);
      if (this.hintDraft().trim()) await this.hints.save(sign.signId, this.hintDraft());
      else if (orig) await this.hints.remove(sign.signId);

      this.toast.ok(orig ? `“${sign.label}” was updated.` : `“${sign.label}” was added.`);
      this.saved = true;
      await this.router.navigateByUrl('/admin/signs');
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) applyServerErrors(this.form, e.fields);
      this.error.set(this.created ? `The sign was added, but something did not save: ${(e as Error).message} Press Save to try again.` : (e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
