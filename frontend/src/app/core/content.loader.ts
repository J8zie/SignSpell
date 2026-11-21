import { setLanding, LandingContent } from '../landing/content';
import { setSite, SiteInfo } from './site.config';

/** Loads the landing-page text and site details from public/content/*.json before startup. */
export async function loadContent(): Promise<void> {
  // Fetches one JSON file, returning null when it is missing or broken.
  const get = async <T>(file: string): Promise<T | null> => {
    try {
      const res = await fetch(`content/${file}`);
      return res.ok ? ((await res.json()) as T) : null;
    } catch { return null; }
  };
  const [site, landing] = await Promise.all([get<SiteInfo>('site.json'), get<LandingContent>('landing.json')]);
  if (site) setSite(site);
  if (landing) setLanding(landing);
}
