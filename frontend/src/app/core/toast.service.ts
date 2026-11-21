import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'ok' | 'bad' | 'info'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<Toast[]>([]);
  private n = 0;
  /** Newest first, at most three on screen, and the same message is never shown twice. */
  show(text: string, kind: Toast['kind'] = 'info', ms = 3500): void {
    const id = ++this.n;
    this.items.update((l) => [...l.filter((t) => t.text !== text), { id, text, kind }].slice(-3));
    setTimeout(() => this.dismiss(id), ms);
  }
  // Shows a short success toast.
  ok(t: string) { this.show(t, 'ok'); }
  // Shows a longer error toast.
  error(t: string) { this.show(t, 'bad', 6000); }
  // Removes one toast from the screen.
  dismiss(id: number): void { this.items.update((l) => l.filter((x) => x.id !== id)); }
}
