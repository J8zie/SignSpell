import { TestBed } from '@angular/core/testing';
import { Preloader } from './preloader';

describe('Preloader', () => {
  beforeEach(() => {
    (globalThis as any).matchMedia ??= () => ({ matches: false });
  });

  function make() {
    const fixture = TestBed.createComponent(Preloader);
    return fixture.componentInstance;
  }

  it('spells SIGNSPELL in 9 tiles', () => {
    expect(make().letters.join('')).toBe('SIGNSPELL');
  });

  it('shows the red hint on the first tile, then green', () => {
    const p = make();
    p.progress.set(6);
    expect(p.stateOf(0)).toBe('bad');
    expect(p.status()).toContain('Red');
    p.progress.set(12);
    expect(p.stateOf(0)).toBe('ok');
    expect(p.status()).toContain('Green');
  });

  it('confirms every tile at 100%', () => {
    const p = make();
    p.progress.set(100);
    expect(p.filled()).toBe(9);
    expect(p.count()).toBe('100');
  });

  it('skip jumps to 100% and emits finished', async () => {
    vi.useFakeTimers();
    const p = make();
    let done = false;
    p.finished.subscribe(() => (done = true));
    p.skip();
    expect(p.progress()).toBe(100);
    vi.advanceTimersByTime(600);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
