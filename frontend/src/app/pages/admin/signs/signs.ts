import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/api';
import { AuthService } from '../../../core/auth.service';
import { Sign, SignType } from '../../../core/models';
import { canManageAdmins } from '../../../core/permissions';
import { ConfirmService } from '../../../core/confirm.service';
import { ToastService } from '../../../core/toast.service';
import { readFilters, writeFilters } from '../../../core/util/url-filters';
import { HintRepository } from '../../../data/hint.repository';
import { LessonMediaRepository } from '../../../data/lesson-media.repository';
import { imagesOf, videoOf } from '../../../shared/media/media-list';
import { Reveal } from '../../../shared/reveal';
import { Slider } from '../../../shared/slider';

/** A short summary of what a sign has beyond its first picture, for the badges on each tile. */
interface Extras { pictures: number; video: boolean; }

/** Admin screen listing all signs (including teacher donations); add/edit happens in the sign studio. */
@Component({
  selector: 'app-signs',
  standalone: true,
  imports: [DatePipe, RouterLink, Reveal, Slider],
  templateUrl: './signs.html',
  styleUrl: './signs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Signs implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly hints = inject(HintRepository);
  private readonly lessonMedia = inject(LessonMediaRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  /** Only the Super Admin may change or delete signs (UI hint; the API enforces it). */
  readonly canEdit = () => canManageAdmins(this.auth.role());
  readonly signs = signal<Sign[]>([]);
  readonly loading = signal(true);
  readonly q = signal('');
  readonly type = signal<'' | SignType>('');
  readonly donated = signal(false);
  /** Hints by sign id, and how many pictures / whether there is a video, for the badges on the tiles. */
  readonly hintsById = signal<Record<string, string>>({});
  readonly extras = signal<Record<string, Extras>>({});
  private timer = 0;

  // Restores filters from the URL and loads the signs.
  async ngOnInit(): Promise<void> {
    // Open exactly where the address says (?q=hello&type=word&donated=1).
    const f = readFilters(this.route, ['q', 'type', 'donated'] as const);
    this.q.set(f.q);
    this.type.set((['letter', 'word', 'sentence'].includes(f.type) ? f.type : '') as '' | SignType);
    this.donated.set(f.donated === '1');
    await this.load();
  }
  // Cancels the pending search timer.
  ngOnDestroy(): void { clearTimeout(this.timer); }

  // Fetches signs and their hint/media badges for the current filters.
  async load(): Promise<void> {
    try {
      const list = await this.api.listSigns({ type: this.type() || undefined, q: this.q().trim() || undefined });
      const shown = this.donated() ? list.filter((s) => s.userOwnershipId) : list;
      // BACKEND INTEGRATION POINT: hints and extra media are read from the frontend repositories today.
      this.hintsById.set(await this.hints.getAll());
      const extras: Record<string, Extras> = {};
      for (const s of shown.filter((x) => x.signType !== 'letter')) {
        const items = await this.lessonMedia.get(s.signId);
        if (items.length) extras[s.signId] = { pictures: imagesOf(items).length, video: !!videoOf(items) };
      }
      this.extras.set(extras);
      this.signs.set(shown);
    } catch (e) { this.toast.error((e as Error).message); }
    finally { this.loading.set(false); }
  }
  // Debounces the search box and reloads the list.
  search(v: string): void { this.q.set(v); clearTimeout(this.timer); this.timer = window.setTimeout(() => { writeFilters(this.router, this.route, { q: v.trim() }); void this.load(); }, 250); }
  // Changes the type filter and reloads the list.
  setType(v: string): void { this.type.set(v as '' | SignType); writeFilters(this.router, this.route, { type: v }); void this.load(); }
  // Toggles the "donated only" filter and reloads the list.
  toggleDonated(): void { this.donated.set(!this.donated()); writeFilters(this.router, this.route, { donated: this.donated() }); void this.load(); }

  // Asks for confirmation, then deletes the sign and its local media/hint data.
  async remove(s: Sign): Promise<void> {
    // Ask the server what would really go, so the dialog shows real numbers.
    let detail = 'and every learner attempt on it';
    try {
      const i = await this.api.signImpact(s.signId);
      const parts = [i.attempts ? `${i.attempts} ${i.attempts === 1 ? 'attempt' : 'attempts'} by ${i.learners} ${i.learners === 1 ? 'learner' : 'learners'}` : '', i.media ? `${i.media} ${i.media === 1 ? 'picture or video' : 'pictures and videos'}` : ''].filter(Boolean);
      detail = parts.length ? `with ${parts.join(' and ')}` : '(nobody has practiced it yet)';
    } catch { /* the impact is only extra detail; the person can still decide */ }
    const ok = await this.confirm.ask({ title: 'Delete this sign?', message: `“${s.label}” will be removed ${detail}. This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await this.api.deleteSign(s.signId);
      await this.lessonMedia.remove(s.signId);
      await this.hints.remove(s.signId);
      this.toast.ok('Sign deleted.');
      await this.load();
    } catch (e) { this.toast.error((e as Error).message); }
  }
}
