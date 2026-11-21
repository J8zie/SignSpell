import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LEVEL_LABEL } from '../../core/mastery';
import { MasteryLevel } from '../../core/models';

/** Small colored badge showing a learner's mastery level. */
@Component({
  selector: 'app-mastery-badge',
  standalone: true,
  template: `<span class="badge" [class]="level()">{{ label() }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MasteryBadge {
  readonly level = input<MasteryLevel>('new');
  // Turns the level key into its friendly label.
  readonly label = computed(() => LEVEL_LABEL[this.level()]);
}
