import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The colorful SIGNSPELL logo; `size` picks small or large, `play` animates the letters in. */
@Component({
  selector: 'app-wordmark',
  standalone: true,
  template: `<span class="wm" [class.xl]="size() === 'xl'" [class.play]="play()" role="img" aria-label="SignSpell">@for (l of letters; track $index) {<span class="l" aria-hidden="true" [style.--i]="$index">{{ l }}</span>}</span>`,
  styleUrl: './wordmark.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wordmark {
  readonly size = input<'sm' | 'xl'>('sm');
  readonly play = input(true);
  readonly letters = 'SIGNSPELL'.split('');
}
