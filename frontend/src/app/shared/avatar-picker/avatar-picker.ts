import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MAX_IMAGE_BYTES, imageProblem } from '../../core/util/image';

/** Round profile-photo picker: click or drop a picture, see a preview, report the file upward. */
@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  template: `
    <div class="wrap">
      <label class="disc" [class.drag]="dragging()" (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="drop($event)">
        @if (preview() ?? current(); as src) { <img [src]="src" alt="Your profile photo"> } @else { <span class="ini" aria-hidden="true">{{ initials() }}</span> }
        <span class="veil" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
          <span>Change</span>
        </span>
        <input class="sr" type="file" accept="image/jpeg,image/png,image/webp" (change)="choose($any($event.target).files, $any($event.target))" aria-label="Choose a profile photo">
      </label>
      @if (preview()) { <button type="button" class="link small" (click)="clear()">Undo new photo</button> }
      @else { <span class="help">JPG, PNG or WebP, up to {{ mb }} MB.</span> }
      @if (error()) { <span class="err">{{ error() }}</span> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: grid; justify-items: center; gap: 0.7rem; text-align: center; }
    .disc { position: relative; display: grid; place-items: center; width: 132px; height: 132px; border-radius: 50%; overflow: hidden; cursor: pointer; background: var(--fg); color: var(--bg); box-shadow: 0 0 0 4px var(--bg), 0 0 0 5px var(--line); transition: box-shadow 0.3s var(--ease), transform 0.4s var(--spring); }
    .disc:hover, .disc.drag { transform: scale(1.04); box-shadow: 0 0 0 4px var(--bg), 0 0 0 6px var(--fg); }
    .disc:focus-within { box-shadow: 0 0 0 4px var(--bg), 0 0 0 6px var(--ring); }
    .disc:active { transform: scale(0.97); }
    img { width: 100%; height: 100%; object-fit: cover; animation: in 0.5s var(--ease); }
    @keyframes in { from { opacity: 0; transform: scale(1.12); } }
    .ini { font-size: 2.6rem; font-weight: 650; letter-spacing: -0.03em; }
    .veil { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 0.2rem; background: var(--veil); color: var(--on-media); font-size: 0.78rem; font-weight: 600; opacity: 0; transition: opacity 0.25s var(--ease); }
    .disc:hover .veil, .disc:focus-within .veil, .disc.drag .veil { opacity: 1; }
    @media (hover: none) { .veil { opacity: 1; top: auto; height: 38%; place-content: center; background: var(--veil); } .veil svg { display: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarPicker {
  readonly current = input<string | null>(null);
  readonly initials = input('');
  readonly picked = output<File | null>();
  readonly preview = signal<string | null>(null);
  readonly error = signal('');
  readonly dragging = signal(false);
  readonly mb = MAX_IMAGE_BYTES / 1024 / 1024;

  // Validates a chosen file, previews it, and emits it to the parent.
  choose(files: FileList | null, el?: HTMLInputElement): void {
    const file = files?.[0];
    if (el) el.value = '';
    if (!file) return;
    const problem = imageProblem(file);
    this.error.set(problem ?? '');
    if (problem) { this.picked.emit(null); return; }
    const r = new FileReader();
    r.onload = () => this.preview.set(r.result as string);
    r.readAsDataURL(file);
    this.picked.emit(file);
  }
  // Handles a picture dropped onto the circle.
  drop(e: DragEvent): void { e.preventDefault(); this.dragging.set(false); this.choose(e.dataTransfer?.files ?? null); }
  // Clears the preview and tells the parent no new photo was picked.
  clear(): void { this.preview.set(null); this.error.set(''); this.picked.emit(null); }
}
