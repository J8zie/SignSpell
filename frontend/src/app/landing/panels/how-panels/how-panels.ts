import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Hand } from '../../../shared/hand/hand';
import { PIPELINE, STEPS } from '../../content';

/** Landing "how it works" panels: pipeline columns and animated hand-sign steps. */
@Component({
  selector: 'app-how-panels',
  standalone: true,
  imports: [Hand],
  templateUrl: './how-panels.html',
  styleUrl: './how-panels.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Landing how-panels component. */
export class HowPanels {
  readonly pipeline = PIPELINE;
  readonly steps = STEPS;
}
