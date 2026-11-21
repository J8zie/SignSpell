import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts in dark mode', () => {
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });

  it('toggles, updates the html attribute and remembers the choice', async () => {
    const svc = TestBed.inject(ThemeService);
    svc.toggle();
    TestBed.tick();
    expect(svc.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('signspell-theme')).toBe('light');
  });

  it('restores a saved theme', () => {
    localStorage.setItem('signspell-theme', 'light');
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });
});
