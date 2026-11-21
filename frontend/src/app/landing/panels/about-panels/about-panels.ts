import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ABOUT, ROLES } from '../../content';

/** Landing "about" panels: intro text plus expandable role cards. */
@Component({
  selector: 'app-about-panels',
  standalone: true,
  templateUrl: './about-panels.html',
  styleUrl: './about-panels.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Landing about-panels component. */
export class AboutPanels {
  readonly about = ABOUT;
  readonly roles = ROLES;
  /** The open card stays open until another is chosen, so the row never snaps back. */
  readonly active = signal(0);
}
