import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { imageProblem } from '../../core/util/image';

/** Chooses a sign picture (JPG, PNG or WebP, up to 2 MB) and shows a preview. */
@Component({
  selector: 'app-image-picker',
  standalone: true,
  templateUrl: './image-picker.html',
  styleUrl: './image-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagePicker {
  readonly current = input<string | null>(null);
  readonly label = input('Picture');
  readonly picked = output<File | null>();
  readonly preview = signal<string | null>(null);
  readonly error = signal('');
  readonly dragging = signal(false);

  // Validates a chosen file, previews it, and emits it to the parent.
  choose(files: FileList | null, input?: HTMLInputElement): void {
    const file = files?.[0];
    if (input) input.value = ''; // so choosing the same file again still fires a change
    if (!file) return;
    const problem = imageProblem(file);
    this.error.set(problem ?? '');
    if (problem) { this.picked.emit(null); return; }
    const r = new FileReader();
    r.onload = () => this.preview.set(r.result as string);
    r.readAsDataURL(file);
    this.picked.emit(file);
  }
  // Handles a picture dropped onto the picker.
  drop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    this.choose(e.dataTransfer?.files ?? null);
  }
  // Clears the preview and tells the parent no new picture was picked.
  clear(): void { this.preview.set(null); this.error.set(''); this.picked.emit(null); }
}
