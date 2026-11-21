import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TimelineItem } from './timeline-items';

/** One clickable dot of the timeline with its labels; it only displays and reports clicks. */
@Component({
  selector: 'app-timeline-node',
  standalone: true,
  templateUrl: './timeline-node.html',
  styleUrl: './timeline-node.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineNode {
  /** The data of this dot. */
  readonly item = input.required<TimelineItem>();
  /** True for the dot the person picked. It grows and gets its label in bold. */
  readonly selected = input(false);
  /** True for dots at or before the selected one, so the line looks filled up to the selection. */
  readonly reached = input(false);
  readonly first = input(false);
  readonly last = input(false);
  /** Reported when the person clicks or presses Enter/Space on the dot. */
  readonly pick = output<void>();
}
