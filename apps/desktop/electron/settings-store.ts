import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from '../shared/settings';

/** Settings live in one JSON file; a missing or broken file means the defaults. */
export function readSettings(file: string): Settings {
  try {
    return mergeSettings(DEFAULT_SETTINGS, JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Written beside, then renamed, so a crash mid-write leaves the previous file intact. */
export function writeSettings(file: string, settings: Settings): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(temporary, file);
}
