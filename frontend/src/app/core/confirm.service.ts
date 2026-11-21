import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest { title: string; message: string; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void; }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  // Opens a confirm dialog and resolves with the person's choice.
  ask(o: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    return new Promise((resolve) =>
      this.request.set({ title: o.title, message: o.message, confirmLabel: o.confirmLabel ?? 'Confirm', danger: o.danger ?? false, resolve }),
    );
  }
  // Closes the dialog and sends the yes/no answer back to the asker.
  answer(ok: boolean): void {
    this.request()?.resolve(ok);
    this.request.set(null);
  }
}
