import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/api';
import { AuthService } from '../../../core/auth.service';
import { Attempt, LearnerSummary, Mastery, MasteryLevel, Sign, SignType } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { Reveal } from '../../../shared/reveal';

interface Ring { type: SignType; title: string; done: number; total: number; pct: number; }

/** Learner home page showing progress rings, stats, recent attempts, and the next sign to practice. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, Reveal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly loading = signal(true);
  readonly signs = signal<Sign[]>([]);
  readonly mastery = signal<Mastery[]>([]);
  readonly recent = signal<Attempt[]>([]);
  /** Totals, streak and what to practice next, worked out by the API in one call. */
  readonly summary = signal<LearnerSummary | null>(null);
  readonly practiced = computed(() => { const s = this.summary(); return s ? s.mastered + s.familiar + s.learning : this.mastery().length; });
  readonly shownAttempts = computed(() => this.summary()?.totalAttempts ?? this.attempts());
  readonly shownAccuracy = computed(() => { const s = this.summary(); return s ? (s.totalAttempts ? Math.round(s.accuracy * 100) : null) : this.accuracy(); });

  private readonly byId = computed(() => new Map(this.signs().map((s) => [s.signId, s])));
  // Mastery rows keyed by sign id for fast lookup.
  private readonly levels = computed(() => new Map(this.mastery().map((m) => [m.signId, m])));
  readonly letters = computed(() => this.signs().filter((s) => s.signType === 'letter'));
  readonly attempts = computed(() => this.mastery().reduce((n, m) => n + m.attemptsCount, 0));
  // Overall correct percentage across every attempt.
  readonly accuracy = computed(() => {
    const n = this.attempts();
    return n ? Math.round((this.mastery().reduce((s, m) => s + m.correctAvg * m.attemptsCount, 0) / n) * 100) : null;
  });
  // Progress rings for letters, words, and sentences.
  readonly rings = computed<Ring[]>(() =>
    (['letter', 'word', 'sentence'] as const).map((type) => {
      const list = this.signs().filter((s) => s.signType === type);
      const done = list.filter((s) => this.levelOf(s.signId) === 'mastered').length;
      return { type, title: type === 'letter' ? 'Letters' : type === 'word' ? 'Words' : 'Sentences', done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
    }),
  );
  /** The weakest practiced letter, or the first letter not tried yet. */
  readonly next = computed(() => {
    const tried = this.letters().filter((s) => this.levels().has(s.signId) && this.levelOf(s.signId) !== 'mastered');
    if (tried.length) return tried.sort((a, b) => this.levels().get(a.signId)!.correctAvg - this.levels().get(b.signId)!.correctAvg)[0];
    return this.letters().find((s) => !this.levels().has(s.signId)) ?? null;
  });
  readonly nextIsNew = computed(() => !!this.next() && !this.levels().has(this.next()!.signId));

  // Returns the learner's mastery level for one sign.
  levelOf(id: string): MasteryLevel { return this.levels().get(id)?.masteryLevel ?? 'new'; }
  /** True for a sign that has never been tried (it has no mastery row yet). */
  isNew(id: string): boolean { return !this.levels().has(id); }
  // Looks up a sign's label for an attempt row.
  label(a: Attempt): string { return this.byId().get(a.signId)?.label ?? '?'; }

  // Loads all the dashboard data in one go.
  async ngOnInit(): Promise<void> {
    try {
      const [signs, mastery, recent, summary] = await Promise.all([this.api.listSigns(), this.api.myMastery(), this.api.myAttempts({ limit: 6 }), this.api.mySummary()]);
      this.signs.set(signs); this.mastery.set(mastery); this.recent.set(recent); this.summary.set(summary);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
