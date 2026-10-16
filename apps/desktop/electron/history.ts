import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { type CaptureItem } from '../shared/ipc';
import { parseIndex, prune } from './history-index';

/**
 * Every capture is kept in Glint's own folder (a PNG of the full capture), whatever the save
 * settings say, so it can be copied again from the history later. The index is one JSON file.
 */
export interface History {
  list(): CaptureItem[];
  add(
    png: Buffer,
    info: {
      name: string;
      width: number;
      height: number;
      savedPath: string | null;
    },
    keep: number,
  ): CaptureItem;
  file(id: string): string | null;
  remove(id: string): CaptureItem[];
  trim(keep: number): void;
}

export function createHistory(root: string): History {
  const indexFile = path.join(root, 'index.json');
  const fileOf = (id: string) => path.join(root, `${id}.png`);
  let items: CaptureItem[] = [];
  try {
    items = parseIndex(JSON.parse(readFileSync(indexFile, 'utf8'))).filter((item) =>
      existsSync(fileOf(item.id)),
    );
  } catch {
    items = [];
  }

  const save = () => {
    mkdirSync(root, { recursive: true });
    writeFileSync(`${indexFile}.tmp`, JSON.stringify({ version: 1, items }));
    renameSync(`${indexFile}.tmp`, indexFile);
  };

  const trim = (keep: number) => {
    const { kept, dropped } = prune(items, keep);
    for (const item of dropped) rmSync(fileOf(item.id), { force: true });
    items = kept;
  };

  return {
    list: () => [...items],
    add(png, info, keep) {
      mkdirSync(root, { recursive: true });
      const id = randomUUID();
      writeFileSync(fileOf(id), png);
      const item: CaptureItem = {
        id,
        createdAt: new Date().toISOString(),
        name: info.name,
        width: info.width,
        height: info.height,
        savedPath: info.savedPath,
        size: statSync(fileOf(id)).size,
      };
      items = [item, ...items];
      trim(keep);
      save();
      return item;
    },
    file: (id) => (items.some((item) => item.id === id) ? fileOf(id) : null),
    remove(id) {
      rmSync(fileOf(id), { force: true });
      items = items.filter((item) => item.id !== id);
      save();
      return [...items];
    },
    trim(keep) {
      trim(keep);
      save();
    },
  };
}
