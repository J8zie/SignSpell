import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { HintButton } from './hint-button';
import { HintPanel } from './hint-panel';

/** Text box where a teacher writes a sign's hint; reports drafts, saves, and removals upward. */
@Component({
  selector: 'app-hint-editor',
  standalone: true,
  imports: [HintButton, HintPanel],
  templateUrl: './hint-editor.html',
  styleUrl: './hint-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HintEditor {
  /** The hint that is already saved, or null when there is none. */
  readonly hint = input<string | null>(null);
  readonly maxLength = input(200);
  /** False hides the Save and Remove buttons (used while a sign is still being created and nothing can be saved yet). */
  readonly showActions = input(true);
  /** Makes the field id unique when several editors are on one page. */
  readonly fieldId = input('hint');
  readonly draftChange = output<string>();
  readonly save = output<string>();
  readonly remove = output<void>();

  /** What is typed in the box. It starts from the saved hint, and starts again whenever a different hint is passed in. */
  readonly draft = linkedSignal(() => this.hint() ?? '');
  /** Whether the "how the learner sees it" preview is open. */
  readonly previewOpen = signal(false);
  readonly learnerOpen = signal(false);

  readonly trimmed = computed(() => this.draft().trim());
  /** True when the box differs from what is saved, so Save is only offered when there is something to save. */
  readonly changed = computed(() => this.trimmed() !== (this.hint() ?? '').trim());
  readonly left = computed(() => this.maxLength() - this.draft().length);

  // Caps the text at maxLength and reports the new draft upward.
  onInput(value: string): void {
    this.draft.set(value.slice(0, this.maxLength()));
    this.draftChange.emit(this.draft());
  }

  /** Saves the trimmed text. An empty box means "no hint", so it removes instead. */
  onSave(): void {
    if (!this.trimmed()) { this.onRemove(); return; }
    this.save.emit(this.trimmed());
  }

  // Clears the box and reports that the hint should be removed.
  onRemove(): void {
    this.draft.set('');
    this.draftChange.emit('');
    this.remove.emit();
  }
}
