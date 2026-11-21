import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/api';
import { levelFor } from '../../../core/mastery';
import { LearnerProgressRow, Sign, TeacherSummary } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { saveBlob } from '../../../core/util/download';
import { DateTimeline } from '../../../shared/date-timeline/date-timeline';
import { dayKey, itemsFromTimestamps } from '../../../shared/date-timeline/timeline-items';
import { Reveal } from '../../../shared/reveal';
import { GraphEdge, GraphNode } from '../../../shared/sign-graph/sign-graph-layout';
import { SignGraph } from '../../../shared/sign-graph/sign-graph';

/** One learner with everything they practiced, ready to show as a single row. */
interface Person {
  id: string;
  name: string;
  initials: string;
  rows: LearnerProgressRow[];
  attempts: number;
  accuracy: number;
  last: string | null;
}

/** Teacher screen showing each learner's progress on the signs this teacher donated. */
@Component({
  selector: 'app-students',
  standalone: true,
  imports: [DatePipe, RouterLink, DateTimeline, SignGraph, Reveal],
  templateUrl: './students.html',
  styleUrl: './students.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Students implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  /** Every progress row the backend returned for this teacher (one per learner and sign). */
  readonly rows = signal<LearnerProgressRow[]>([]);
  /** The signs this teacher donated. */
  readonly mine = signal<Sign[]>([]);
  /** Whole-teacher totals from the API (how many signs were donated, when learners last practiced). */
  readonly summary = signal<TeacherSummary | null>(null);
  /** All letter signs, so words can be joined to their letters in the graph. */
  readonly letters = signal<Sign[]>([]);

  // What the teacher has chosen. All three narrow the learner rows the same way.
  /** The chosen day on the timeline ("2026-11-08"), or null for all time. */
  readonly day = signal<string | null>(null);
  /** The chosen sign in the graph (a sign id), or null. */
  readonly node = signal<string | null>(null);
  readonly name = signal('');

  /**
   * The dots of the timeline: one per day on which a learner LAST practiced one of these signs.
   * BACKEND INTEGRATION POINT: the progress rows only tell us each learner's last attempt. When the backend can
   * return every day that has attempts, build these items from that list instead (same TimelineItem shape).
   */
  readonly timeline = computed(() => itemsFromTimestamps(this.rows().map((r) => r.lastAttemptAt)));

  private readonly mineIds = computed(() => new Set(this.mine().map((s) => s.signId)));
  /** The signs the learner list can be narrowed to: only signs this teacher donated have rows. */
  private readonly signFilter = computed(() => (this.node() && this.mineIds().has(this.node()!) ? this.node() : null));

  /** The rows left after the day, sign and name choices. */
  readonly shown = computed(() => {
    const n = this.name().trim().toLowerCase();
    const d = this.day();
    const s = this.signFilter();
    return this.rows().filter((r) =>
      (!n || r.learnerName.toLowerCase().includes(n)) &&
      (!d || (r.lastAttemptAt && dayKey(r.lastAttemptAt) === d)) &&
      (!s || r.signId === s));
  });

  /** The rows grouped by learner, most recently active first. */
  readonly people = computed<Person[]>(() => {
    const byLearner = new Map<string, LearnerProgressRow[]>();
    for (const r of this.shown()) byLearner.set(r.learnerId, [...(byLearner.get(r.learnerId) ?? []), r]);
    return [...byLearner.entries()].map(([id, rows]) => {
      const attempts = rows.reduce((n, r) => n + r.attemptsCount, 0);
      const name = rows[0].learnerName;
      return {
        id, name, rows: [...rows].sort((a, b) => (b.lastAttemptAt ?? '').localeCompare(a.lastAttemptAt ?? '')),
        initials: name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase(),
        attempts,
        accuracy: attempts ? Math.round((rows.reduce((s, r) => s + r.correctAvg * r.attemptsCount, 0) / attempts) * 100) : 0,
        last: rows.map((r) => r.lastAttemptAt ?? '').sort().pop() || null,
      };
    }).sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));
  });

  // Overall totals across the filtered rows.
  readonly attempts = computed(() => this.shown().reduce((n, r) => n + r.attemptsCount, 0));
  readonly accuracy = computed(() => (this.attempts() ? Math.round((this.shown().reduce((s, r) => s + r.correctAvg * r.attemptsCount, 0) / this.attempts()) * 100) : null));
  /** True when any filter (day, sign, or name) is active. */
  readonly filtered = computed(() => !!(this.day() || this.signFilter() || this.name().trim()));

  // ---------- the sign graph ----------
  /** True when at least one word or sentence exists, so there is something to connect to letters. */
  readonly hasStructure = computed(() => this.mine().some((s) => s.signType !== 'letter'));

  /** How well learners know each sign, combined over every learner who practiced it. */
  private readonly signStats = computed(() => {
    const stats = new Map<string, { attempts: number; correct: number; learners: Set<string> }>();
    for (const r of this.rows()) {
      const s = stats.get(r.signId) ?? { attempts: 0, correct: 0, learners: new Set<string>() };
      s.attempts += r.attemptsCount; s.correct += r.correctAvg * r.attemptsCount; s.learners.add(r.learnerId);
      stats.set(r.signId, s);
    }
    return stats;
  });

  /** One graph node for a sign, coloured by how well learners know it (no colour when nobody practiced it). */
  private nodeFor(s: Sign): GraphNode {
    const st = this.signStats().get(s.signId);
    const acc = st && st.attempts ? st.correct / st.attempts : 0;
    return {
      id: s.signId, label: s.label, kind: s.signType,
      level: st ? levelFor(st.attempts, acc) : null,
      detail: st ? `${st.learners.size} learner${st.learners.size === 1 ? '' : 's'} · ${Math.round(acc * 100)}% correct` : 'nobody has practiced it yet',
    };
  }

  /**
   * The graph's data. The relationships are real: a word is joined to the letters it is spelled with, and a
   * sentence to the donated words it contains (or to its letters when none of its words is a donated sign).
   * Nothing is invented; a letter only appears when some word or sentence of this teacher uses it.
   */
  readonly graph = computed<{ nodes: GraphNode[]; edges: GraphEdge[] }>(() => {
    const donated = this.mine();
    const letterId = new Map(this.letters().map((l) => [l.label, l.signId]));
    const wordId = new Map(donated.filter((s) => s.signType === 'word').map((s) => [s.label, s.signId]));
    const edges: GraphEdge[] = [];
    const needed = new Set<string>(); // letters that some word or sentence is spelled with

    /** The distinct letters of a text that exist as letter signs. */
    const lettersOf = (text: string) => [...new Set(text.replace(/[^A-Z]/g, '').split(''))].filter((l) => letterId.has(l));
    const spellWith = (signId: string, text: string) => lettersOf(text).forEach((l) => { needed.add(l); edges.push({ from: signId, to: letterId.get(l)! }); });

    for (const s of donated) {
      if (s.signType === 'word') spellWith(s.signId, s.label);
      if (s.signType === 'sentence') {
        // A sentence is joined to the donated words it contains; with none of those, to its letters.
        const parts = s.label.split(' ').map((w) => wordId.get(w)).filter((id): id is string => !!id);
        if (parts.length) parts.forEach((p) => edges.push({ from: s.signId, to: p }));
        else spellWith(s.signId, s.label);
      }
    }

    const ids = new Set<string>();
    const nodes: GraphNode[] = [];
    const add = (s: Sign | undefined) => { if (s && !ids.has(s.signId)) { ids.add(s.signId); nodes.push(this.nodeFor(s)); } };
    donated.forEach(add);                                        // every sign the teacher donated
    this.letters().filter((l) => needed.has(l.label)).forEach(add); // plus the letters they are spelled with
    return { nodes, edges };
  });

  // Loads progress rows, the teacher's signs, letters, and summary.
  async ngOnInit(): Promise<void> {
    try {
      // BACKEND INTEGRATION POINT: these three calls are the data this screen needs from the backend.
      const [rows, mine, letters, summary] = await Promise.all([this.api.learnerProgress({}), this.api.listSigns({ mine: true }), this.api.listSigns({ type: 'letter' }), this.api.teacherSummary()]);
      this.rows.set(rows); this.mine.set(mine); this.letters.set(letters); this.summary.set(summary);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Picking a chip under a learner lights up that sign in the graph. */
  focusSign(signId: string): void { this.node.set(this.node() === signId ? null : signId); }

  // Clears the day, sign, and name filters.
  clear(): void { this.day.set(null); this.node.set(null); this.name.set(''); }

  readonly exporting = signal(false);

  /**
   * Downloads the table as a CSV. The file comes from the server with the day and sign choices applied.
   * A name search only exists on this screen, so when one is typed the file is built here from the rows shown,
   * which keeps the file identical to what the teacher is looking at.
   */
  async exportCsv(): Promise<void> {
    this.exporting.set(true);
    try {
      if (this.name().trim()) { saveBlob(this.csvOfShown(), 'signspell-learner-progress.csv'); return; }
      const day = this.day();
      saveBlob(await this.api.exportProgress({ from: day ?? undefined, to: day ?? undefined, signId: this.signFilter() ?? undefined }), 'signspell-learner-progress.csv');
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.exporting.set(false);
    }
  }

  // Builds the CSV file from the currently shown rows.
  private csvOfShown(): Blob {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Learner', 'Sign', 'Type', 'Attempts', 'Correct %', 'Level', 'Last practiced'].map(esc).join(',')];
    for (const r of this.shown()) lines.push([r.learnerName, r.signLabel, r.signType, r.attemptsCount, Math.round(r.correctAvg * 100), r.masteryLevel, r.lastAttemptAt ?? ''].map(esc).join(','));
    return new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  }
}
