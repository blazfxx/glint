import { describe, expect, it } from 'vitest';
import { matches, parseIndex, prune } from '../electron/history-index';
import { type CaptureItem } from '../shared/ipc';

const item = (n: number, name = `Glint ${String(n)}`): CaptureItem => ({
  id: `0000000${String(n)}-aaaa`,
  createdAt: new Date(2026, 9, n).toISOString(),
  name,
  width: 10,
  height: 10,
  savedPath: null,
  size: 100,
});

describe('history index', () => {
  it('keeps good entries, newest first, and drops broken ones', () => {
    const raw = { items: [item(1), { id: 'BAD' }, item(3), 'nope'] };
    expect(parseIndex(raw).map((i) => i.name)).toEqual(['Glint 3', 'Glint 1']);
    expect(parseIndex(null)).toEqual([]);
    expect(parseIndex({ items: 4 })).toEqual([]);
  });

  it('prunes the oldest beyond the limit, or nothing when the limit is 0', () => {
    const list = [item(3), item(2), item(1)];
    expect(prune(list, 2).dropped.map((i) => i.name)).toEqual(['Glint 1']);
    expect(prune(list, 0).dropped).toEqual([]);
  });

  it('searches names and dates by every word', () => {
    expect(matches(item(5, 'Login page bug'), 'login bug')).toBe(true);
    expect(matches(item(5, 'Login page bug'), 'login crash')).toBe(false);
    expect(matches(item(5), '2026-10')).toBe(true);
  });
});
