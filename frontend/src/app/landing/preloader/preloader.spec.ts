import { TestBed } from '@angular/core/testing';
import { Preloader } from './preloader';

describe('Preloader (the split-second intro)', () => {
  beforeEach(() => {
    (globalThis as any).matchMedia ??= () => ({ matches: false });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  function make() {
    const fixture = TestBed.createComponent(Preloader);
    let finished = 0;
    fixture.componentInstance.finished.subscribe(() => finished++);
    fixture.detectChanges(); // runs ngOnInit, which starts the timers
    return { p: fixture.componentInstance, done: () => finished };
  }

  it('finishes by itself in well under a second', () => {
    const { p, done } = make();
    vi.advanceTimersByTime(400);
    expect(done()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(done()).toBe(1);
    expect(p.leaving()).toBe(true);
    vi.advanceTimersByTime(400);
    expect(p.hidden()).toBe(true);
  });

  it('skip finishes right away, and only once', () => {
    const { p, done } = make();
    p.skip();
    p.skip();
    vi.advanceTimersByTime(50);
    expect(done()).toBe(1);
    vi.advanceTimersByTime(2000);
    expect(done()).toBe(1);
  });
});
