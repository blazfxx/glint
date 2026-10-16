import {
  SHORTCUT_ACTIONS,
  normalizeAccelerator,
  systemConflict,
  type Platform,
  type ShortcutAction,
  type ShortcutMap,
} from '@glint/shortcuts';
import { globalShortcut } from 'electron';
import { type ShortcutStatus, type ShortcutStatuses } from '../shared/ipc';

/**
 * Registers every shortcut and reports how each one went: a clash with another Glint action or
 * with the system is not registered at all, and one another app already holds is reported as taken.
 */
export function registerShortcuts(
  map: ShortcutMap,
  platform: Platform,
  run: (action: ShortcutAction) => void,
): ShortcutStatuses {
  globalShortcut.unregisterAll();
  const statuses = {} as Record<ShortcutAction, ShortcutStatus>;
  const owner = new Map<string, ShortcutAction>();
  for (const action of SHORTCUT_ACTIONS) {
    const value = map[action];
    if (value === null) {
      statuses[action] = { state: 'off' };
      continue;
    }
    const normal = normalizeAccelerator(value);
    if (!normal) {
      statuses[action] = { state: 'invalid' };
      continue;
    }
    const first = owner.get(normal);
    if (first) {
      statuses[action] = { state: 'duplicate', with: first };
      continue;
    }
    owner.set(normal, action);
    const reason = systemConflict(normal, platform);
    if (reason) {
      statuses[action] = { state: 'system', reason };
      continue;
    }
    let registered: boolean;
    try {
      registered = globalShortcut.register(normal, () => {
        run(action);
      });
    } catch {
      registered = false;
    }
    statuses[action] = registered ? { state: 'active' } : { state: 'taken' };
  }
  return statuses;
}
