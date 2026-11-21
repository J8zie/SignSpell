import { HandState } from '../shared/hand/hand';

/**
 * The shapes of the landing-page copy. The words themselves are not written in code: they are read from
 * public/content/landing.json when the app starts (see core/content.loader.ts). Edit that file to change the text.
 */
export interface Chapter { id: string; label: string; }
export interface Hero { tagline: string[]; lead: string; }
export interface About { title: string; lead: string; facts: { big: string; text: string }[]; }
export interface Roles { title: string; cards: { id: string; title: string; tag: string; icon: string; text: string }[]; }
export interface Pipeline { title: string; lead: string; columns: { title: string; items: string[] }[]; }
export interface Step { n: string; glyph: string; chip: string; title: string; text: string; hand: HandState; }
export interface LandingContent { CHAPTERS: Chapter[]; HERO: Hero; ABOUT: About; ROLES: Roles; PIPELINE: Pipeline; STEPS: Step[]; }

/** Filled by `setLanding` before the first screen is drawn. (Exported `let`s, so every file sees the loaded value.) */
export let CHAPTERS: Chapter[] = [];
export let HERO: Hero = { tagline: [], lead: '' };
export let ABOUT: About = { title: '', lead: '', facts: [] };
export let ROLES: Roles = { title: '', cards: [] };
export let PIPELINE: Pipeline = { title: '', lead: '', columns: [] };
export let STEPS: Step[] = [];

/** Loads the landing page text from public/content/landing.json into these exports. */
export function setLanding(c: LandingContent): void {
  ({ CHAPTERS, HERO, ABOUT, ROLES, PIPELINE, STEPS } = c);
}
