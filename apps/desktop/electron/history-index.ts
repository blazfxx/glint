import { z } from 'zod';
import { type CaptureItem } from '../shared/ipc';

export const captureItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{8,64}$/),
  createdAt: z.string(),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  savedPath: z.string().nullable(),
  size: z.number().int().nonnegative(),
});

/** Reads the index, keeping each well-formed entry and dropping the rest. Newest first. */
export function parseIndex(raw: unknown): CaptureItem[] {
  const list = typeof raw === 'object' && raw !== null && 'items' in raw ? raw.items : null;
  if (!Array.isArray(list)) return [];
  const items: CaptureItem[] = [];
  for (const entry of list) {
    const parsed = captureItemSchema.safeParse(entry);
    if (parsed.success) items.push(parsed.data);
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Splits the list into what to keep (newest `keep`) and what to drop; keep 0 keeps everything. */
export function prune(
  items: readonly CaptureItem[],
  keep: number,
): { kept: CaptureItem[]; dropped: CaptureItem[] } {
  if (keep <= 0 || items.length <= keep) return { kept: [...items], dropped: [] };
  return { kept: items.slice(0, keep), dropped: items.slice(keep) };
}

/** History search: every word must appear in the name or the date. */
export function matches(item: CaptureItem, query: string): boolean {
  const haystack = `${item.name} ${item.createdAt.slice(0, 10)}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
