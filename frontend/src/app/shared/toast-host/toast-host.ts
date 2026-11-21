import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast.service';

/** Shows the app's toast notifications at the bottom of the screen. */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHost { readonly toast = inject(ToastService); }
