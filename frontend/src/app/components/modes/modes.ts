import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Mode { id: string; title: string; tag: string; glyph: string; text: string; img: string; tint: string; }

@Component({
  selector: 'app-modes',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './modes.html',
  styleUrl: './modes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modes {
  /** The open card stays open until another is chosen, so the row never snaps back. */
  readonly active = signal(0);
  /** Where each card's button goes. Defaults suit the public landing page. */
  readonly links = input<Record<string, string>>({ letters: '/register', words: '/register', sentences: '/register', progress: '/register' });
  readonly queries = input<Record<string, Record<string, string>>>({});
  readonly cta = input('Get started');
  readonly heading = input('Practice at your own pace');
  readonly intro = input('A webcam and a browser are all you need. Hover or tap a card.');
  readonly modes: Mode[] = [
    { id: 'letters', title: 'Letters', glyph: 'A', tag: 'A to Z, ASL manual alphabet', img: 'mode-letters.jpg',
      tint: 'linear-gradient(150deg,#0f6b4a,#34d399)',
      text: 'Pick a letter from the searchable guide and press Get Started. Match the reference sign. You get green when you are right, and red with a hint when you are not.' },
    { id: 'words', title: 'Words', glyph: 'CAT', tag: '3 to 5 letters in 60 seconds', img: 'mode-words.jpg',
      tint: 'linear-gradient(150deg,#0b5560,#5eead4)',
      text: 'Confirmed letters join into a word. Repeat a letter by changing your hand or leaving the frame first, so one held sign is not counted twice.' },
    { id: 'sentences', title: 'Sentences', glyph: 'I AM', tag: 'Up to 5 words in 3 minutes', img: 'mode-sentences.jpg',
      tint: 'linear-gradient(150deg,#1b4b6b,#7ee0c3)',
      text: 'Use the on-screen Space button to start a new word and build a simple sentence, letter by letter. SignSpell does not translate sign grammar or facial expression.' },
    { id: 'progress', title: 'Progress', glyph: '92%', tag: 'Any lesson in 3 clicks', img: 'mode-progress.jpg',
      tint: 'linear-gradient(150deg,#d4283c,#34d399)',
      text: 'Every attempt is saved and each letter gets a mastery level, so weak letters are easy to find. Teachers view learner progress and donate signs. Admins manage accounts and sign pictures.' },
  ];
}
