/** Project details for the landing page, loaded from public/content/site.json. */
export interface SiteInfo {
  name: string; school: string; address: string; course: string; period: string; adviser: string;
  team: readonly string[];
  goals: readonly { code: string; name: string }[];
}

/** Filled by setSite before the first screen is drawn. */
export let SITE: SiteInfo = { name: '', school: '', address: '', course: '', period: '', adviser: '', team: [], goals: [] };
// Replaces the site details with the loaded JSON.
export function setSite(s: SiteInfo): void { SITE = s; }
