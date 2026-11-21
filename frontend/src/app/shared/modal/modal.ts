import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { closeDialog, openDialog } from '../../core/motion';

/** Form dialog on the native <dialog> element; the parent controls `open` and hears `closed`. */
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.html',
  styleUrl: './modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  readonly open = input(false);
  readonly heading = input('');
  /** "wide" gives editors with pictures more room. */
  readonly size = input<'normal' | 'wide'>('normal');
  readonly closed = output<void>();
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  /** A click on the dark backdrop closes the dialog. Must return nothing: a returned `false` would cancel form submits. */
  backdrop(e: Event, dlg: HTMLDialogElement): void {
    if (e.target === dlg) this.closed.emit();
  }

  // Opens or closes the dialog whenever the parent's `open` flag changes.
  constructor() {
    // Follow the parent's `open` flag: play the opening animation, or the closing one before really closing.
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.open() && !d.open) openDialog(d);
      else if (!this.open() && d.open) closeDialog(d);
    });
  }
}
