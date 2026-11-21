import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterRenderEffect, computed, inject, input, output, viewChild } from '@angular/core';
import { Motion, gsap, reducedMotion } from '../../core/motion';
import { GraphEdge, GraphNode, layoutSignGraph, neighbourhood } from './sign-graph-layout';

/** Interactive graph showing which signs are made of which; color shows learner mastery. */
@Component({
  selector: 'app-sign-graph',
  standalone: true,
  templateUrl: './sign-graph.html',
  styleUrl: './sign-graph.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignGraph implements OnDestroy {
  /** Every sign to draw. */
  readonly nodes = input.required<GraphNode[]>();
  /** Which signs are made of which (a word of its letters, a sentence of its words). */
  readonly edges = input<GraphEdge[]>([]);
  /** Id of the chosen sign, or null. */
  readonly selected = input<string | null>(null);
  /** Reported when the person picks a sign (or picks the same sign again, which reports null). */
  readonly selectedChange = output<string | null>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  // Owns every animation this graph starts so they are stopped and undone when it is destroyed.
  private readonly motion = new Motion(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  private drawn = false;

  /** Where everything goes. Recomputed only when the data changes. */
  readonly layout = computed(() => layoutSignGraph(this.nodes(), this.edges()));
  /** The chosen sign and everything joined to it (these stay bright, the rest fades back). */
  readonly lit = computed(() => (this.selected() ? neighbourhood(this.selected()!, this.edges()) : null));
  readonly chosen = computed(() => this.layout().nodes.find((n) => n.id === this.selected()) ?? null);
  /** The labels of the signs joined to the chosen one, for the caption under the graph. */
  readonly parts = computed(() => {
    const id = this.selected();
    if (!id) return [];
    const byId = new Map(this.layout().nodes.map((n) => [n.id, n.label]));
    return this.edges().filter((e) => e.from === id).map((e) => byId.get(e.to) ?? '').filter(Boolean);
  });
  // Labels of the signs this sign is used in (the reverse direction).
  readonly usedIn = computed(() => {
    const id = this.selected();
    if (!id) return [];
    const byId = new Map(this.layout().nodes.map((n) => [n.id, n.label]));
    return this.edges().filter((e) => e.to === id).map((e) => byId.get(e.from) ?? '').filter(Boolean);
  });

  constructor() {
    // The first time the graph appears: signs pop in and the lines draw themselves.
    afterRenderEffect(() => {
      this.layout(); // re-run when the data changes
      const svg = this.svg().nativeElement;
      if (this.drawn || reducedMotion() || !this.nodes().length) { this.drawn = true; return; }
      this.drawn = true;
      this.motion.run(() => {
        gsap.from(svg.querySelectorAll('.sg-node'), { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(1.8)', stagger: { each: 0.03, from: 'end' } });
        gsap.from(svg.querySelectorAll('.sg-edge'), { strokeDashoffset: 1, opacity: 0, duration: 0.8, ease: 'power2.out', stagger: 0.03, delay: 0.25 });
      });
    });

    // Whenever the choice changes: fade the signs that are not connected, brighten the connected ones.
    afterRenderEffect(() => {
      const lit = this.lit();
      const svg = this.svg().nativeElement;
      const nodes = Array.from(svg.querySelectorAll<SVGGElement>('.sg-node'));
      const edges = Array.from(svg.querySelectorAll<SVGPathElement>('.sg-edge'));
      const dur = reducedMotion() ? 0 : 0.35;
      this.motion.run(() => {
        gsap.to(nodes, { opacity: (i: number) => (!lit || lit.has(nodes[i].dataset['id']!) ? 1 : 0.22), duration: dur, ease: 'power2.out' });
        gsap.to(edges, { opacity: (i: number) => (!lit ? 0.55 : lit.has(edges[i].dataset['from']!) && lit.has(edges[i].dataset['to']!) ? 1 : 0.08), strokeWidth: (i: number) => (lit && lit.has(edges[i].dataset['from']!) && lit.has(edges[i].dataset['to']!) ? 3 : 1.6), duration: dur });
      });
    });
  }

  /** Picking the same sign again clears the choice. */
  pick(id: string): void { this.selectedChange.emit(this.selected() === id ? null : id); }

  /** Enter and Space pick a sign, so the graph works without a mouse. */
  onKey(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(id); }
  }

  // Stops all running animations when the graph is destroyed.
  ngOnDestroy(): void { this.motion.destroy(); }
}
