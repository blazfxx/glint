/**
 * Global shortcuts as data: Electron accelerator strings, read from key presses, shown the way
 * each system writes them, and checked for clashes with each other and with the system.
 */

export type Platform = 'darwin' | 'win32' | 'linux';

/** Everything a shortcut can start. Later phases add their own actions here. */
export const SHORTCUT_ACTIONS = [
  'captureArea',
  'captureScreen',
  'captureWindow',
  'capturePrevious',
  'openHistory',
] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export const ACTION_LABELS: Readonly<Record<ShortcutAction, string>> = {
  captureArea: 'Capture area',
  captureScreen: 'Capture full screen',
  captureWindow: 'Capture window',
  capturePrevious: 'Capture previous area',
  openHistory: 'Open history',
};

/** A binding per action; null means the action has no shortcut. */
export type ShortcutMap = Readonly<Record<ShortcutAction, string | null>>;

/**
 * Defaults stay clear of the system's own: macOS uses ⌘⇧3, 4, 5 and 6 for its screenshots, and
 * ⌥⇧ with a letter types a character, so Glint takes ⌘⇧ (Ctrl+Shift elsewhere) with 1, 2, 7, 8, 9.
 */
export const DEFAULT_SHORTCUTS: ShortcutMap = {
  captureArea: 'CommandOrControl+Shift+1',
  captureScreen: 'CommandOrControl+Shift+2',
  captureWindow: 'CommandOrControl+Shift+7',
  capturePrevious: 'CommandOrControl+Shift+8',
  openHistory: 'CommandOrControl+Shift+9',
};

const MODIFIER_ORDER = ['CommandOrControl', 'Control', 'Alt', 'Shift', 'Super'] as const;
type Modifier = (typeof MODIFIER_ORDER)[number];

const MODIFIER_ALIASES: Readonly<Record<string, Modifier>> = {
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  command: 'CommandOrControl',
  cmd: 'CommandOrControl',
  control: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
};

const NAMED_KEYS = [
  'Space',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Return',
  'Escape',
  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'PrintScreen',
  'Plus',
];
const PUNCTUATION = [',', '.', '/', ';', "'", '[', ']', '\\', '`', '-', '='];

function canonicalKey(key: string): string | null {
  if (/^[a-z0-9]$/i.test(key)) return key.toUpperCase();
  const fn = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(key);
  if (fn) return `F${fn[1] ?? ''}`;
  const named = NAMED_KEYS.find((name) => name.toLowerCase() === key.toLowerCase());
  if (named) return named;
  if (key.toLowerCase() === 'enter') return 'Return';
  if (key.toLowerCase() === 'esc') return 'Escape';
  return PUNCTUATION.includes(key) ? key : null;
}

export interface ParsedAccelerator {
  readonly modifiers: readonly Modifier[];
  readonly key: string;
}

/** Splits and tidies an accelerator; null when it is not one Electron accepts. */
export function parseAccelerator(accelerator: string): ParsedAccelerator | null {
  // "Plus" is how a + key is written, so a plain split on + is safe.
  const parts = accelerator.split('+').map((part) => part.trim());
  if (parts.some((part) => part === '')) return null;
  const keyPart = parts.at(-1);
  if (keyPart === undefined) return null;
  const key = canonicalKey(keyPart);
  if (!key) return null;
  const modifiers = new Set<Modifier>();
  for (const part of parts.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (!modifier || modifiers.has(modifier)) return null;
    modifiers.add(modifier);
  }
  return { modifiers: MODIFIER_ORDER.filter((m) => modifiers.has(m)), key };
}

/** The one spelling of an accelerator, so equal shortcuts compare equal. */
export function normalizeAccelerator(accelerator: string): string | null {
  const parsed = parseAccelerator(accelerator);
  return parsed ? [...parsed.modifiers, parsed.key].join('+') : null;
}

/** The parts of a keydown event a shortcut is read from. */
export interface KeyPress {
  readonly code: string;
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

const CODE_KEYS: Readonly<Record<string, string>> = {
  Space: 'Space',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Enter: 'Return',
  NumpadEnter: 'Return',
  Escape: 'Escape',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  PrintScreen: 'PrintScreen',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
};

export type RecordResult =
  | { readonly status: 'waiting' }
  | { readonly status: 'done'; readonly accelerator: string }
  | { readonly status: 'invalid'; readonly reason: string };

/**
 * Turns a key press into a shortcut. Physical keys (`code`) are used so a shortcut means the same
 * key on every keyboard layout. A shortcut needs a modifier, except the F keys and Print Screen.
 */
export function recordKeyPress(press: KeyPress, platform: Platform): RecordResult {
  if (['Meta', 'Control', 'Alt', 'Shift', 'OS'].includes(press.key)) return { status: 'waiting' };
  let key: string | undefined;
  const letter = /^Key([A-Z])$/.exec(press.code);
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(press.code);
  if (letter) key = letter[1];
  else if (digit) key = digit[1];
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(press.code)) key = press.code;
  else key = CODE_KEYS[press.code];
  if (!key)
    return {
      status: 'invalid',
      reason: 'That key cannot be used in a shortcut.',
    };

  const modifiers: Modifier[] = [];
  const primary = platform === 'darwin' ? press.metaKey : press.ctrlKey;
  if (primary) modifiers.push('CommandOrControl');
  if (platform === 'darwin' && press.ctrlKey) modifiers.push('Control');
  if (press.altKey) modifiers.push('Alt');
  if (press.shiftKey) modifiers.push('Shift');
  if (platform !== 'darwin' && press.metaKey) modifiers.push('Super');

  const standsAlone = /^F\d+$/.test(key) || key === 'PrintScreen';
  const onlyShift = modifiers.length === 1 && modifiers[0] === 'Shift';
  if (!standsAlone && (modifiers.length === 0 || onlyShift)) {
    return {
      status: 'invalid',
      reason: `Add ${platform === 'darwin' ? '⌘, ⌃ or ⌥' : 'Ctrl or Alt'}: a key on its own would stop working for typing.`,
    };
  }
  return { status: 'done', accelerator: [...modifiers, key].join('+') };
}

const MAC_SYMBOLS: Readonly<Record<Modifier, string>> = {
  CommandOrControl: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Super: '⌘',
};
const PC_NAMES: Readonly<Record<Modifier, string>> = {
  CommandOrControl: 'Ctrl',
  Control: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Super: 'Win',
};
const MAC_KEYS: Readonly<Record<string, string>> = {
  Return: '↩',
  Escape: '⎋',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Space: 'Space',
  Plus: '+',
};

/** How the system writes a shortcut: "⌘⇧1" on a Mac, "Ctrl+Shift+1" elsewhere. */
export function formatAccelerator(accelerator: string, platform: Platform): string {
  const parsed = parseAccelerator(accelerator);
  if (!parsed) return accelerator;
  if (platform === 'darwin') {
    const order: Modifier[] = ['Control', 'Alt', 'Shift', 'CommandOrControl', 'Super'];
    const mods = order.filter((m) => parsed.modifiers.includes(m)).map((m) => MAC_SYMBOLS[m]);
    return [...new Set(mods)].join('') + (MAC_KEYS[parsed.key] ?? parsed.key);
  }
  const names = [...new Set(parsed.modifiers.map((m) => PC_NAMES[m]))];
  return [...names, parsed.key === 'Plus' ? '+' : parsed.key].join('+');
}

/** Shortcuts the system keeps for itself; registering them would fail or break something. */
export function systemConflict(accelerator: string, platform: Platform): string | null {
  const normal = normalizeAccelerator(accelerator);
  if (!normal) return null;
  const reserved: Readonly<Record<Platform, Readonly<Record<string, string>>>> = {
    darwin: {
      'CommandOrControl+Shift+3': 'macOS uses it for its own screenshot of the screen.',
      'CommandOrControl+Shift+4': 'macOS uses it for its own screenshot of an area.',
      'CommandOrControl+Shift+5': 'macOS uses it for its screenshot toolbar.',
      'CommandOrControl+Shift+6': 'macOS uses it for a screenshot of the Touch Bar.',
      'CommandOrControl+Q': 'It quits apps.',
      'CommandOrControl+W': 'It closes windows.',
      'CommandOrControl+Tab': 'It switches apps.',
      'CommandOrControl+Space': 'It opens Spotlight.',
      'CommandOrControl+H': 'It hides apps.',
      'CommandOrControl+C': 'It copies.',
      'CommandOrControl+V': 'It pastes.',
      'CommandOrControl+X': 'It cuts.',
      'CommandOrControl+Z': 'It undoes.',
    },
    win32: {
      'Alt+F4': 'It closes windows.',
      'Alt+Tab': 'It switches windows.',
      'Shift+Super+S': 'Windows uses it for Snipping Tool.',
      'Super+L': 'It locks the computer.',
      'Super+D': 'It shows the desktop.',
      'CommandOrControl+C': 'It copies.',
      'CommandOrControl+V': 'It pastes.',
      'CommandOrControl+X': 'It cuts.',
      'CommandOrControl+Z': 'It undoes.',
    },
    linux: {
      'Alt+F4': 'It closes windows.',
      'Alt+Tab': 'It switches windows.',
      'CommandOrControl+Alt+T': 'It opens a terminal on many desktops.',
      'CommandOrControl+C': 'It copies.',
      'CommandOrControl+V': 'It pastes.',
      'CommandOrControl+X': 'It cuts.',
      'CommandOrControl+Z': 'It undoes.',
    },
  };
  return reserved[platform][normal] ?? null;
}

/** Actions whose shortcuts are the same as another action's, grouped by shortcut. */
export function findConflicts(map: ShortcutMap): ShortcutAction[][] {
  const byAccelerator = new Map<string, ShortcutAction[]>();
  for (const action of SHORTCUT_ACTIONS) {
    const value = map[action];
    const normal = value === null ? null : normalizeAccelerator(value);
    if (!normal) continue;
    byAccelerator.set(normal, [...(byAccelerator.get(normal) ?? []), action]);
  }
  return [...byAccelerator.values()].filter((actions) => actions.length > 1);
}
