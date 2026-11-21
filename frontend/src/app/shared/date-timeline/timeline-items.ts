/** Helpers that turn real timestamps into timeline dots (only days with data get a dot). */

/** One dot on the timeline. The component that shows it does not know where the data came from. */
export interface TimelineItem {
  /** Stable id of the dot (here the calendar day, "2026-11-08"). The parent gets this back when a dot is picked. */
  key: string;
  /** Main text under the dot, for example "Nov 8". */
  label: string;
  /** Small text under the label, for example the year. */
  detail?: string;
  /** How many records happened on this day (shown as a small badge). */
  count?: number;
}

// Zero-pads a number to two digits for date keys.
const pad = (n: number): string => String(n).padStart(2, '0');

/** The local calendar day of a timestamp as "YYYY-MM-DD". Returns '' for text that is not a date. */
export function dayKey(timestamp: string): string {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Groups timestamps by day and returns one dot per day with data, oldest first. */
export function itemsFromTimestamps(timestamps: (string | null | undefined)[]): TimelineItem[] {
  const counts = new Map<string, number>();
  for (const t of timestamps) {
    const key = t ? dayKey(t) : '';
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return { key, count, label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), detail: String(y) };
    });
}
