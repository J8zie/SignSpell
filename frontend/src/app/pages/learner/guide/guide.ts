import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/api';
import { Mastery, MasteryLevel, Sign, SignType } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { MasteryBadge } from '../../../shared/mastery-badge/mastery-badge';
import { CUES } from '../../../recognition/hints';
import { Reveal } from '../../../shared/reveal';
import { Slider } from '../../../shared/slider';

type TypeFilter = 'all' | SignType;
type Sort = 'az' | 'za' | 'weak' | 'recent';
interface Row { sign: Sign; m: Mastery | null; }

/** The sign guide where learners search, filter, and browse all signs. */
@Component({
  selector: 'app-sign-guide',
  standalone: true,
  imports: [RouterLink, MasteryBadge, Reveal, Slider],
  templateUrl: './guide.html',
  styleUrl: './guide.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignGuide implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly type = signal<TypeFilter>('letter');
  readonly query = signal('');
  readonly level = signal<'all' | MasteryLevel>('all');
  readonly sort = signal<Sort>('az');
  readonly signs = signal<Sign[]>([]);
  readonly mastery = signal<Mastery[]>([]);
  readonly loading = signal(true);
  readonly selectedId = signal<string | null>(null);
  readonly types: { id: TypeFilter; label: string }[] = [
    { id: 'letter', label: 'Letters' }, { id: 'word', label: 'Words' }, { id: 'sentence', label: 'Sentences' }, { id: 'all', label: 'All' },
  ];

  /** Step 1.1: a search is valid when it is short and uses letters, numbers, spaces, hyphens or apostrophes. */
  readonly queryError = computed(() => {
    const q = this.query().trim();
    if (q.length > 30) return 'That search is too long. Use 30 characters or fewer.';
    if (!/^[A-Za-z0-9 '\-]*$/.test(q)) return 'Use letters, numbers and spaces only.';
    return '';
  });

  // Mastery rows keyed by sign id for fast lookup.
  private readonly masteryById = computed(() => new Map(this.mastery().map((m) => [m.signId, m])));
  /** Steps 1.3 and 1.4: filter by mastery, then sort. */
  readonly rows = computed(() => {
    const lv = this.level();
    const rows = this.signs()
      .map((s) => ({ sign: s, m: this.masteryById().get(s.signId) ?? null }))
      .filter((r) => lv === 'all' || (r.m?.masteryLevel ?? 'new') === lv);
    const score = (r: { m: Mastery | null }) => (r.m ? r.m.correctAvg : 0.5);
    const by: Record<Sort, (a: (typeof rows)[0], b: (typeof rows)[0]) => number> = {
      az: (a, b) => a.sign.label.localeCompare(b.sign.label),
      za: (a, b) => b.sign.label.localeCompare(a.sign.label),
      weak: (a, b) => score(a) - score(b) || a.sign.label.localeCompare(b.sign.label),
      recent: (a, b) => (b.m?.updatedAt ?? '').localeCompare(a.m?.updatedAt ?? ''),
    };
    return rows.sort(by[this.sort()]);
  });
  // The selected row, falling back to the first row when nothing was picked.
  readonly selected = computed<Row | null>(() => this.rows().find((r) => r.sign.signId === this.selectedId()) ?? (this.rows()[0] as Row | undefined) ?? null);
  readonly activeId = computed(() => this.selected()?.sign.signId ?? null);
  readonly filtered = computed(() => !!this.query().trim() || this.level() !== 'all');

  private timer = 0;

  // Reads the type from the URL, loads mastery, then loads signs.
  async ngOnInit(): Promise<void> {
    const t = this.route.snapshot.queryParamMap.get('type');
    if (t === 'letter' || t === 'word' || t === 'sentence' || t === 'all') this.type.set(t);
    try { this.mastery.set(await this.api.myMastery()); } catch { /* the list still works without it */ }
    await this.load();
  }
  // Cancels the pending search timer.
  ngOnDestroy(): void { clearTimeout(this.timer); }

  // Returns the practice hint text for a sign.
  cue(s: Sign): string {
    if (s.signType === 'letter') return CUES[s.label] ?? 'Match the reference picture.';
    return `Spell it letter by letter: ${s.label.split('').join(' ').replace(/ {3}/g, '  /  ')}.`;
  }
  // Formats a mastery record as a percentage string.
  accuracy(m: Mastery | null): string { return m ? `${Math.round(m.correctAvg * 100)}%` : '–'; }

  // Changes the type filter and reloads.
  setType(t: TypeFilter): void { this.type.set(t); void this.load(); }
  onQuery(v: string): void {
    this.query.set(v);
    clearTimeout(this.timer);
    if (this.queryError()) return; // do not search with an invalid query
    this.timer = window.setTimeout(() => void this.load(), 250);
  }
  // Clears the search and level filters, then reloads.
  clear(): void { this.query.set(''); this.level.set('all'); void this.load(); }

  // Fetches signs for the current type and query.
  async load(): Promise<void> {
    if (this.queryError()) return;
    this.loading.set(true);
    try {
      const t = this.type();
      this.signs.set(await this.api.listSigns({ type: t === 'all' ? undefined : t, q: this.query().trim() || undefined }));
    } catch (e) {
      this.signs.set([]);
      this.toast.error((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
