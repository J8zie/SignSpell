import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Preloader } from '../../components/preloader/preloader';
import { Header } from '../../components/header/header';
import { Hero } from '../../components/hero/hero';
import { Journey } from '../../components/journey/journey';
import { Modes } from '../../components/modes/modes';
import { Guide } from '../../components/guide/guide';
import { Footer } from '../../components/footer/footer';

const SEEN = 'signspell-intro-seen';

/** The public landing page. The intro plays once per browser session. */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Preloader, Header, Hero, Journey, Modes, Guide, Footer],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit, OnDestroy {
  readonly showIntro = !this.seen();
  readonly ready = signal(!this.showIntro);
  private readonly root = document.documentElement;

  ngOnInit(): void {
    this.root.style.scrollBehavior = 'smooth';
    if (this.showIntro) this.root.classList.add('is-loading');
  }
  onReady(): void {
    this.ready.set(true);
    this.root.classList.remove('is-loading');
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ }
  }
  ngOnDestroy(): void {
    this.root.classList.remove('is-loading');
    this.root.style.scrollBehavior = '';
  }
  private seen(): boolean {
    try { return sessionStorage.getItem(SEEN) === '1'; } catch { return false; }
  }
}
