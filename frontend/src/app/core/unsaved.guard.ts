import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from './confirm.service';

/** A screen that can tell whether the person has typed or chosen something they have not saved yet. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a screen with unsaved work, so a stray click on a link never throws it away. */
export const unsavedGuard: CanDeactivateFn<HasUnsavedChanges> = (screen) =>
  !screen.hasUnsavedChanges() ||
  inject(ConfirmService).ask({
    title: 'Leave without saving?',
    message: 'You have changes that are not saved. If you leave now, they will be lost.',
    confirmLabel: 'Leave',
    danger: true,
  });
