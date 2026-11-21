import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/api';
import { Attempt, Mastery, MasteryLevel, Sign, SignType } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { DateTimeline } from '../../../shared/date-timeline/date-timeline';
import { dayKey, itemsFromTimestamps } from '../../../shared/date-timeline/timeline-items';
import { MasteryBadge } from '../../../shared/mastery-badge/mastery-badge';
import { Reveal } from '../../../shared/reveal';
import { Slider } from '../../../shared/slider';

/** Learner progress screen with a mastery view and a practice-history timeline. */
@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [DatePipe, RouterLink, MasteryBadge, DateTimeline, Reveal, Slider],
  templateUrl: './progress.html',
  styleUrl: './progress.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Progress implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  readonly tab = signal<'mastery' | 'history'>('mastery');
  readonly loading = signal(true);
  readonly signs = signal<Sign[]>([]);
  readonly mastery = signal<Mastery[]>([]);
  /** Every attempt of this learner, newest first. The filters below only narrow what is shown. */
  readonly attempts = signal<Attempt[]>([]);

  // What the learner chose in the History view.
  /** The chosen practice day ("2026-11-08"), or null for all days. */
  readonly day = signal<string | null>(null);
  readonly type = signal<'all' | SignType>('all');
  /** How many attempts are shown before "Show more". */
  readonly shown = signal(25);
  readonly typeChoices: { id: 'all' | SignType; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'letter', label: 'Letters' }, { id: 'word', label: 'Words' }, { id: 'sentence', label: 'Sentences' }];

  private readonly byMastery = computed(() => new Map(this.mastery().map((m) => [m.signId, m])));
  private readonly byId = computed(() => new Map(this.signs().map((s) => [s.signId, s])));
  readonly letters = computed(() => this.signs().filter((s) => s.signType === 'letter'));
  readonly others = computed(() => this.signs().filter((s) => s.signType !== 'letter' && this.byMastery().has(s.signId)));
  readonly total = computed(() => this.mastery().reduce((n, m) => n + m.attemptsCount, 0));
  readonly accuracy = computed(() => (this.total() ? Math.round((this.mastery().reduce((s, m) => s + m.correctAvg * m.attemptsCount, 0) / this.total()) * 100) : null));
  readonly counts = computed(() => {
    const c: Record<MasteryLevel, number> = { new: 0, learning: 0, familiar: 0, mastered: 0 };
    this.letters().forEach((s) => c[this.level(s.signId)]++);
    return c;
  });

  // Attempts of the chosen type; the timeline is built from these.
  private readonly ofType = computed(() => {
    const t = this.type();
    return t === 'all' ? this.attempts() : this.attempts().filter((a) => this.byId().get(a.signId)?.signType === t);
  });
  /** The dots of the timeline: only days with at least one attempt, so empty days are never suggested. */
  readonly timeline = computed(() => itemsFromTimestamps(this.ofType().map((a) => a.createdAt)));
  /** The attempts after the day choice. */
  readonly filtered = computed(() => (this.day() ? this.ofType().filter((a) => dayKey(a.createdAt) === this.day()) : this.ofType()));
  readonly visible = computed(() => this.filtered().slice(0, this.shown()));

  // Returns a sign's mastery level.
  level(id: string): MasteryLevel { return this.byMastery().get(id)?.masteryLevel ?? 'new'; }
  // Returns a sign's mastery record or null.
  m(id: string): Mastery | null { return this.byMastery().get(id) ?? null; }
  // Returns a sign's correct average as a whole percent.
  pct(id: string): number { return Math.round((this.byMastery().get(id)?.correctAvg ?? 0) * 100); }
  // Looks up the sign an attempt was made on.
  signOf(a: Attempt): Sign | undefined { return this.byId().get(a.signId); }

  // Loads signs, mastery, and every attempt.
  async ngOnInit(): Promise<void> {
    try {
      // BACKEND INTEGRATION POINT: these three calls are all the data this screen needs.
      const [signs, mastery, attempts] = await Promise.all([this.api.listSigns(), this.api.myMastery(), this.api.myAttempts({})]);
      this.signs.set(signs); this.mastery.set(mastery); this.attempts.set(attempts);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  // Selects a practice day and resets the list length.
  setDay(day: string | null): void { this.day.set(day); this.shown.set(25); }

  // Changes the type filter and clears a day that no longer has matching attempts.
  setType(type: 'all' | SignType): void {
    this.type.set(type);
    this.shown.set(25);
    // A day that has no attempts of the new type no longer exists on the timeline, so go back to all days.
    if (this.day() && !this.timeline().some((i) => i.key === this.day())) this.day.set(null);
  }
}
