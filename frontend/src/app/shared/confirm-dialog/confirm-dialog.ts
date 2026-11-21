import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../core/confirm.service';
import { closeDialog, openDialog } from '../../core/motion';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly svc = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  // Treats a click on the dark backdrop as "cancel".
  backdrop(e: Event, dlg: HTMLDialogElement): void {
    if (e.target === dlg) this.svc.answer(false);
  }
  // Opens or closes the dialog whenever a confirm request appears or is answered.
  constructor() {
    effect(() => {
      const d = this.dlg().nativeElement;
      // Same open/close animation as every other dialog in the app.
      if (this.svc.request()) { if (!d.open) openDialog(d); } else if (d.open) closeDialog(d);
    });
  }
}
