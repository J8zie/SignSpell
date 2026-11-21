import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PuzzlePiece, buildPuzzle } from './puzzle';

const COLS = 5, ROWS = 3, W = 1000, H = 600;

interface Piece extends PuzzlePiece {
  /** Where it flies in from (distance in picture units) and how much it is turned before it snaps in. */
  tx: number; ty: number; rot: number;
  /** Order of arrival (a shuffle, so the pieces do not land row by row). */
  j: number;
}

/** Landing panel with an animated jigsaw puzzle of the SIGNSPELL letters. */
@Component({
  selector: 'app-puzzle-panel',
  standalone: true,
  templateUrl: './puzzle-panel.html',
  styleUrl: './puzzle-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Jigsaw puzzle panel component. */
export class PuzzlePanel {
  readonly w = W;
  readonly h = H;
  readonly letters = 'SIGNSPELL'.split('');
  readonly pieces: Piece[] = buildPuzzle(COLS, ROWS, W, H).map((p, i) => {
    const a = (i * 137.5 + 20) * (Math.PI / 180);
    const dist = 380 + ((i * 53) % 5) * 55;
    return {
      ...p,
      tx: Math.round(Math.cos(a) * dist),
      ty: Math.round(Math.sin(a) * dist * 0.75),
      rot: ((i % 2 ? 1 : -1) * (24 + ((i * 37) % 7) * 8)),
      j: (i * 7) % (COLS * ROWS), // 7 and 15 share no factor, so this visits every number once
    };
  });
  /** Soft colour blobs behind the letters, so every piece looks different even where there is no letter. */
  readonly blobs = [
    { x: 120, y: 110, r: 95, c: 1 }, { x: 860, y: 95, r: 72, c: 4 }, { x: 515, y: 505, r: 110, c: 5 },
    { x: 145, y: 475, r: 80, c: 7 }, { x: 905, y: 485, r: 100, c: 9 }, { x: 505, y: 70, r: 55, c: 2 },
  ];
}
