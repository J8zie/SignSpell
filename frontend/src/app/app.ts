import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from './shared/toast-host/toast-host';
import { ConfirmDialog } from './shared/confirm-dialog/confirm-dialog';

/** Root component: renders the routed page plus the global toast and confirm-dialog hosts. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastHost, ConfirmDialog],
  template: `<router-outlet /><app-toast-host /><app-confirm-dialog />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Root app component. */
export class App {}
