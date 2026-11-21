import { dayKey, itemsFromTimestamps } from './timeline-items';

describe('timeline items', () => {
  it('makes one dot per day that has data, oldest first, with a count', () => {
    const items = itemsFromTimestamps(['2026-11-08T09:00:00', '2026-11-02T10:00:00', '2026-11-08T21:30:00']);
    expect(items.map((i) => i.key)).toEqual(['2026-11-02', '2026-11-08']);
    expect(items.map((i) => i.count)).toEqual([1, 2]);
  });

  it('does not invent days between the real ones', () => {
    const items = itemsFromTimestamps(['2026-01-01T12:00:00', '2026-12-31T12:00:00']);
    expect(items.length).toBe(2);
  });

  it('skips empty and invalid timestamps', () => {
    expect(itemsFromTimestamps([null, undefined, '', 'not a date'])).toEqual([]);
    expect(dayKey('nope')).toBe('');
  });

  it('labels the dot with the month and day and keeps the year as detail', () => {
    const [item] = itemsFromTimestamps(['2026-11-08T09:00:00']);
    expect(item.detail).toBe('2026');
    expect(item.label).toMatch(/8/);
  });
});
