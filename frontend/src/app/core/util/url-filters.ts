import { ActivatedRoute, Router } from '@angular/router';

/** Reads the screen's filters out of the URL query string. */
export function readFilters<K extends string>(route: ActivatedRoute, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = route.snapshot.queryParamMap.get(k) ?? '';
  return out;
}

// Writes filter values back into the URL without adding history entries.
export function writeFilters(router: Router, route: ActivatedRoute, values: Record<string, string | boolean | null | undefined>): void {
  const queryParams: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(values)) queryParams[k] = v === true ? '1' : v === false || v === '' || v == null ? null : String(v);
  void router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
}
