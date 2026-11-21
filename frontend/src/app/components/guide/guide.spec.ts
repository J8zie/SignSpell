import { TestBed } from '@angular/core/testing';
import { Guide } from './guide';

function setup() {
  (globalThis as any).matchMedia ??= () => ({ matches: false });
  const fixture = TestBed.createComponent(Guide);
  fixture.detectChanges();
  return fixture.componentInstance;
}
const type = (g: Guide, v: string) => g.onSearch({ target: { value: v } } as unknown as Event);

describe('Guide', () => {
  it('lists all 26 letters by default', () => {
    expect(setup().list().length).toBe(26);
  });

  it('a single character searches the letter itself', () => {
    const g = setup();
    type(g, 'm');
    expect(g.list().map((x) => x.l)).toEqual(['M']);
    expect(g.selected()).toBe('M');
  });

  it('longer text searches the hand-shape hint', () => {
    const g = setup();
    type(g, 'pinky');
    expect(g.list().map((x) => x.l)).toEqual(['I', 'J', 'Y']);
  });

  it('flags the look-alike and motion letters from the proposal', () => {
    const g = setup();
    const kinds = (ls: string[]) => ls.map((l) => (type(g, ''), g.pick(l), g.current().kind));
    expect(kinds(['A', 'M', 'N', 'S', 'T'])).toEqual(Array(5).fill('look-alike'));
    expect(kinds(['J', 'Z'])).toEqual(['motion', 'motion']);
  });

  it('shows nothing for an unknown search', () => {
    const g = setup();
    type(g, 'zzzz');
    expect(g.list().length).toBe(0);
  });
});
