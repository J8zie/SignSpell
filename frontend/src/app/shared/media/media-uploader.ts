import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { imageProblem } from '../../core/util/image';
import { videoProblem } from '../../core/util/video';
import { MediaItem } from './media-item';
import { MediaSequence } from './media-sequence';
import { addImages, imagesOf, removeItem, setVideo, videoOf } from './media-list';

let counter = 0;
/** A unique id made in the browser for each chosen file. */
const newId = (): string => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Teacher upload area for a word/sentence's pictures and video; it only builds the item list locally. */
@Component({
  selector: 'app-media-uploader',
  standalone: true,
  imports: [MediaSequence],
  templateUrl: './media-uploader.html',
  styleUrl: './media-uploader.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaUploader {
  /** The list owned by the parent. */
  readonly items = input.required<MediaItem[]>();
  /** The most pictures one sign may have. */
  readonly maxImages = input(12);
  /** Reported with the NEW list after anything is added, removed or reordered. */
  readonly itemsChange = output<MediaItem[]>();

  /** Messages about files that were refused (wrong type, too big), shown under the drop area. */
  readonly problems = signal<string[]>([]);
  /** True while files are being dragged over the drop area (to highlight it). */
  readonly dragging = signal(false);
  readonly video = computed(() => videoOf(this.items()));
  readonly imageCount = computed(() => imagesOf(this.items()).length);

  /** Reads the chosen files: pictures join the sequence, the first video becomes the video. */
  addFiles(files: FileList | File[] | null): void {
    if (!files) return;
    const problems: string[] = [];
    let next = this.items();
    const pics: MediaItem[] = [];
    let video: MediaItem | null = null;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('video/')) {
        const problem = videoProblem(file);
        if (problem) problems.push(`${file.name}: ${problem}`);
        else if (!video) video = this.toItem(file, 'video');
        else problems.push(`${file.name}: only one video can be added.`);
      } else {
        const problem = imageProblem(file);
        if (problem) problems.push(`${file.name}: ${problem}`);
        else if (imagesOf(next).length + pics.length >= this.maxImages()) problems.push(`${file.name}: a sign can have up to ${this.maxImages()} pictures.`);
        else pics.push(this.toItem(file, 'image'));
      }
    }
    if (pics.length) next = addImages(next, pics);
    if (video) { const old = videoOf(next); if (old) URL.revokeObjectURL(old.url); next = setVideo(next, video); }
    this.problems.set(problems);
    if (pics.length || video) this.itemsChange.emit(next);
  }

  /** Turns a chosen file into a MediaItem. `URL.createObjectURL` makes a temporary local address the browser can show. */
  private toItem(file: File, type: 'image' | 'video'): MediaItem {
    const url = URL.createObjectURL(file);
    return { id: newId(), type, name: file.name, url, previewUrl: type === 'image' ? url : '', sequence: null, file };
  }

  /** From the file buttons: pass the files on, then clear the input so choosing the same file again still works. */
  onPick(input: HTMLInputElement): void {
    this.addFiles(input.files);
    input.value = '';
  }

  // Handles files dropped onto the upload area.
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    this.addFiles(e.dataTransfer?.files ?? null);
  }

  /** A picture was removed from the sequence: free its temporary address (the list change comes separately). */
  forget(item: MediaItem): void { URL.revokeObjectURL(item.url); }

  // Removes the video and frees its temporary address.
  removeVideo(): void {
    const v = this.video();
    if (!v) return;
    URL.revokeObjectURL(v.url);
    this.itemsChange.emit(removeItem(this.items(), v.id));
  }
}
