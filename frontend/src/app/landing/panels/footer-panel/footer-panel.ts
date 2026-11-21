import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Magnetic } from '../../../shared/magnetic';
import { SITE } from '../../../core/site.config';

/** Landing footer panel with site links and copyright year. */
@Component({
  selector: 'app-footer-panel',
  standalone: true,
  imports: [RouterLink, Magnetic],
  templateUrl: './footer-panel.html',
  styleUrl: './footer-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Landing footer panel component. */
export class FooterPanel {
  readonly site = SITE;
  readonly year = new Date().getFullYear();
}
