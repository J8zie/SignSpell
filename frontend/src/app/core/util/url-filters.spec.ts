import { ActivatedRoute, Router } from '@angular/router';
import { readFilters, writeFilters } from './url-filters';

describe('url filters', () => {
  it('reads the filters from the address, empty when missing', () => {
    const route = { snapshot: { queryParamMap: new Map([['q', 'hello'], ['type', 'word']]) } } as unknown as ActivatedRoute;
    expect(readFilters(route, ['q', 'type', 'donated'] as const)).toEqual({ q: 'hello', type: 'word', donated: '' });
  });

  it('writes only the filters that have a value, without adding history entries', () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const route = {} as ActivatedRoute;
    writeFilters({ navigate } as unknown as Router, route, { q: 'cat', type: '', donated: true, role: null });
    const [, extras] = navigate.mock.calls[0];
    expect(extras.queryParams).toEqual({ q: 'cat', type: null, donated: '1', role: null });
    expect(extras.replaceUrl).toBe(true);
    expect(extras.queryParamsHandling).toBe('merge');
  });
});
