import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  findConflicts,
  formatAccelerator,
  normalizeAccelerator,
  parseAccelerator,
  recordKeyPress,
  systemConflict,
  type KeyPress,
} from '../src/index';

const press = (over: Partial<KeyPress>): KeyPress => ({
  code: 'Digit1',
  key: '1',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
});

describe('accelerators', () => {
  it('normalizes spellings to one form', () => {
    expect(normalizeAccelerator('shift+cmd+1')).toBe('CommandOrControl+Shift+1');
    expect(normalizeAccelerator('Ctrl+Alt+a')).toBe('Control+Alt+A');
    expect(normalizeAccelerator('CmdOrCtrl+enter')).toBe('CommandOrControl+Return');
    expect(normalizeAccelerator('F12')).toBe('F12');
  });

  it('rejects what Electron would not accept', () => {
    expect(parseAccelerator('')).toBeNull();
    expect(parseAccelerator('Cmd+')).toBeNull();
    expect(parseAccelerator('Shift+Shift+A')).toBeNull();
    expect(parseAccelerator('Hyper+A')).toBeNull();
    expect(parseAccelerator('Cmd+Á')).toBeNull();
  });

  it('normalizing twice changes nothing', () => {
    const keys = fc.constantFrom('A', 'z', '5', 'F7', 'Space', 'Up', ',', 'Plus');
    const mods = fc.subarray(['Cmd', 'Ctrl', 'Alt', 'Shift', 'Super']);
    fc.assert(
      fc.property(mods, keys, (m, k) => {
        const once = normalizeAccelerator([...m, k].join('+'));
        expect(once).not.toBeNull();
        expect(normalizeAccelerator(once ?? '')).toBe(once);
      }),
    );
  });

  it('shows shortcuts the way each system writes them', () => {
    expect(formatAccelerator('CommandOrControl+Shift+1', 'darwin')).toBe('⇧⌘1');
    expect(formatAccelerator('CommandOrControl+Shift+1', 'win32')).toBe('Ctrl+Shift+1');
    expect(formatAccelerator('Control+Alt+Return', 'darwin')).toBe('⌃⌥↩');
    expect(formatAccelerator('Super+Shift+S', 'linux')).toBe('Shift+Win+S');
  });
});

describe('recording a key press', () => {
  it('reads the physical key and the system primary modifier', () => {
    expect(recordKeyPress(press({ metaKey: true, shiftKey: true }), 'darwin')).toEqual({
      status: 'done',
      accelerator: 'CommandOrControl+Shift+1',
    });
    expect(recordKeyPress(press({ ctrlKey: true, shiftKey: true }), 'win32')).toEqual({
      status: 'done',
      accelerator: 'CommandOrControl+Shift+1',
    });
    // On a French keyboard the key is "&" but the code is still Digit1.
    expect(recordKeyPress(press({ key: '&', ctrlKey: true }), 'linux')).toEqual({
      status: 'done',
      accelerator: 'CommandOrControl+1',
    });
    expect(recordKeyPress(press({ code: 'KeyA', key: 'a', ctrlKey: true }), 'darwin')).toEqual({
      status: 'done',
      accelerator: 'Control+A',
    });
  });

  it('waits on a lone modifier, and refuses keys that would break typing', () => {
    expect(
      recordKeyPress(press({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }), 'darwin'),
    ).toEqual({ status: 'waiting' });
    expect(recordKeyPress(press({}), 'darwin').status).toBe('invalid');
    expect(recordKeyPress(press({ shiftKey: true }), 'win32').status).toBe('invalid');
    expect(recordKeyPress(press({ code: 'F5', key: 'F5' }), 'win32')).toEqual({
      status: 'done',
      accelerator: 'F5',
    });
    expect(recordKeyPress(press({ code: 'IntlRo', ctrlKey: true }), 'win32').status).toBe(
      'invalid',
    );
  });
});

describe('conflicts', () => {
  it('the defaults clash with nothing', () => {
    expect(findConflicts(DEFAULT_SHORTCUTS)).toEqual([]);
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      for (const value of Object.values(DEFAULT_SHORTCUTS)) {
        expect(systemConflict(value ?? '', platform)).toBeNull();
      }
    }
  });

  it('finds two actions on one shortcut, however it is spelled', () => {
    const map = {
      ...DEFAULT_SHORTCUTS,
      openHistory: 'shift+cmd+1',
      captureWindow: null,
    };
    expect(findConflicts(map)).toEqual([['captureArea', 'openHistory']]);
  });

  it('knows the system screenshot keys', () => {
    expect(systemConflict('Cmd+Shift+4', 'darwin')).toMatch(/macOS/);
    expect(systemConflict('Cmd+Shift+4', 'win32')).toBeNull();
    expect(systemConflict('Super+Shift+S', 'win32')).toMatch(/Snipping/);
  });
});
